import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  Edit,
  Calendar,
  Clock,
  MapPin,
  Target,
  Megaphone,
  FileText,
  User,
  Flame,
  Thermometer,
  Snowflake,
  ExternalLink,
  XCircle,
  Copy,
  History,
  Building2,
  UserCheck,
  AlertTriangle,
  MessageCircle
} from "lucide-react";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import LeadActivityTimeline from "@/components/LeadActivityTimeline";
import LeadCustomFields from "@/components/LeadCustomFields";
import LeadFormFields from "@/components/LeadFormFields";
import { DISQUALIFICATION_REASONS } from "@/components/leads/DisqualifyLeadModal";
import { toast } from "@/hooks/use-toast";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeadWhatsAppFailure } from "@/hooks/use-whatsapp-failures";
import { useScheduledMessages, formatScheduledTime } from "@/hooks/use-scheduled-messages";
import { useAccount } from "@/hooks/use-account";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MessageSquareWarning, WifiOff, Timer } from "lucide-react";
import { useMessages, Conversation } from "@/hooks/use-conversations";
import { ChatView } from "@/components/conversations/ChatView";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interesse?: string;
  observacoes?: string;
  origem?: string;
  campanha?: string;
  conjunto?: string;
  anuncio?: string;
  created_at: string;
  updated_at: string;
  status_id?: string;
  temperature?: string | null;
  assigned_broker_id?: string | null;
  property_id?: string | null;
  is_duplicate?: boolean;
  duplicate_of_lead_id?: string | null;
  lead_status?: {
    name: string;
    color: string;
  };
}

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lead: Lead) => void;
}

interface DuplicateLeadInfo {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status_name?: string;
  status_color?: string;
  temperature?: string | null;
  created_at: string;
  updated_at: string;
  broker_name?: string | null;
  observacoes?: string | null;
}

const LeadDetailModal = ({ lead, open, onOpenChange, onEdit }: LeadDetailModalProps) => {
  const { account } = useAccount();
  const [activeTab, setActiveTab] = useState<'details' | 'whatsapp'>('details');
  const [brokerName, setBrokerName] = useState<string | null>(null);
  const [propertyInfo, setPropertyInfo] = useState<{ title: string; city?: string } | null>(null);
  const [disqualificationData, setDisqualificationData] = useState<{ reasons: string[]; notes: string | null } | null>(null);
  const [duplicateLeadInfo, setDuplicateLeadInfo] = useState<DuplicateLeadInfo | null>(null);
  const { failure: whatsappFailure, isDisconnected: whatsappDisconnected } = useLeadWhatsAppFailure(lead?.id, account?.id ?? undefined);
  const { nextMessage: scheduledMessage, totalPending: scheduledCount } = useScheduledMessages(lead?.id);

  // WhatsApp inline chat state
  const [whatsappConversation, setWhatsappConversation] = useState<Conversation | null>(null);
  const cleanPhone = (lead?.phone || '').replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const remoteJid = `${fullPhone}@s.whatsapp.net`;
  const { messages: whatsappMessages, loading: whatsappMessagesLoading, sendMessage: sendWhatsAppMessage } = useMessages(
    activeTab === 'whatsapp' && whatsappConversation ? whatsappConversation.remote_jid : null,
    activeTab === 'whatsapp' ? (whatsappConversation?.lead_id || lead?.id || null) : null
  );

  const loadWhatsAppConversation = useCallback(async () => {
    if (!account?.id || !lead?.id) return;

    const makeLeadObj = () => ({
      id: lead.id,
      name: lead.name,
      phone: fullPhone,
      email: null,
      temperature: null,
      status_id: null,
      property_id: null,
      assigned_broker_id: null,
      origem: null,
      interesse: null,
      observacoes: null,
    });

    // 1. Try exact JID match
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('account_id', account.id)
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    if (conv) {
      setWhatsappConversation({ ...conv, unread_count: conv.unread_count ?? 0, last_message_is_from_me: conv.last_message_is_from_me ?? false, lead: makeLeadObj() });
      return;
    }

    // 2. Fallback: search by lead_id (handles JID format differences)
    const { data: convByLead } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('account_id', account.id)
      .eq('lead_id', lead.id)
      .not('remote_jid', 'like', '%@lid')
      .maybeSingle();

    if (convByLead) {
      setWhatsappConversation({ ...convByLead, unread_count: convByLead.unread_count ?? 0, last_message_is_from_me: convByLead.last_message_is_from_me ?? false, lead: makeLeadObj() });
      return;
    }

    // 3. Virtual conversation
    setWhatsappConversation({
      id: '', account_id: account.id, remote_jid: remoteJid, phone: fullPhone,
      contact_name: lead.name, last_message: null, last_message_at: null,
      last_message_is_from_me: false, unread_count: 0, lead_id: lead.id, lead: makeLeadObj(),
    });
  }, [account?.id, lead?.id, remoteJid]);

  useEffect(() => {
    if (activeTab === 'whatsapp' && open && !whatsappConversation) {
      loadWhatsAppConversation();
    }
  }, [activeTab, open, whatsappConversation, loadWhatsAppConversation]);

  useEffect(() => {
    if (!open) {
      setActiveTab('details');
      setWhatsappConversation(null);
    }
  }, [open]);

  useEffect(() => {
    if (lead?.assigned_broker_id) {
      supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', lead.assigned_broker_id)
        .single()
        .then(({ data }) => setBrokerName(data?.full_name || null));
    } else {
      setBrokerName(null);
    }

    if (lead?.property_id) {
      supabase
        .from('properties')
        .select('title, city')
        .eq('id', lead.property_id)
        .single()
        .then(({ data }) => setPropertyInfo(data || null));
    } else {
      setPropertyInfo(null);
    }

    // Fetch disqualification reasons if status is "Perdido"
    if (lead?.lead_status?.name === "Perdido") {
      supabase
        .from('lead_disqualification_reasons')
        .select('reasons, notes')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setDisqualificationData(data ? { reasons: data.reasons as string[], notes: data.notes } : null));
    } else {
      setDisqualificationData(null);
    }

    // Fetch duplicate lead info
    if (lead?.is_duplicate && lead?.duplicate_of_lead_id) {
      (async () => {
        const { data: dupLead } = await supabase
          .from('leads')
          .select('id, name, phone, email, temperature, created_at, updated_at, observacoes, assigned_broker_id, lead_status(name, color)')
          .eq('id', lead.duplicate_of_lead_id!)
          .single();
        
        if (dupLead) {
          let dupBrokerName: string | null = null;
          if (dupLead.assigned_broker_id) {
            const { data: bp } = await supabase.from('profiles').select('full_name').eq('user_id', dupLead.assigned_broker_id).single();
            dupBrokerName = bp?.full_name || null;
          }
          const ls = dupLead.lead_status as any;
          setDuplicateLeadInfo({
            id: dupLead.id,
            name: dupLead.name,
            phone: dupLead.phone,
            email: dupLead.email,
            status_name: ls?.name,
            status_color: ls?.color,
            temperature: dupLead.temperature,
            created_at: dupLead.created_at,
            updated_at: dupLead.updated_at,
            broker_name: dupBrokerName,
            observacoes: dupLead.observacoes,
          });
        } else {
          setDuplicateLeadInfo(null);
        }
      })();
    } else {
      setDuplicateLeadInfo(null);
    }
  }, [lead?.assigned_broker_id, lead?.property_id, lead?.id, lead?.lead_status?.name, lead?.is_duplicate, lead?.duplicate_of_lead_id]);

  if (!lead) return null;

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const createdAt = formatDateTime(lead.created_at);
  const updatedAt = formatDateTime(lead.updated_at);

  const getTemperatureInfo = (temp: string | null | undefined) => {
    switch (temp) {
      case 'hot':
        return { label: 'Quente', icon: Flame, color: 'text-red-500', bg: 'bg-red-500/10' };
      case 'cold':
        return { label: 'Frio', icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      default:
        return { label: 'Morno', icon: Thermometer, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    }
  };

  const tempInfo = getTemperatureInfo(lead.temperature);
  const TempIcon = tempInfo.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full p-0 gap-0 overflow-hidden flex flex-col bg-[#2b2d2c] border-l border-white/10 [&>button]:text-[#a6c8e1] [&>button]:hover:text-white">
        <VisuallyHidden>
          <SheetTitle>Detalhes do Lead: {lead.name}</SheetTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="relative p-6 pb-5 border-b border-white/10">
          {/* Nome e Avatar */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#5a5f65] border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(129,175,209,0.3)]">
              <span className="text-lg font-bold text-[#81afd1]">
                {lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white truncate">{lead.name}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {lead.lead_status && (
                  <Badge 
                    className="px-2.5 py-0.5"
                    style={{ 
                      backgroundColor: `${lead.lead_status.color}20`,
                      borderColor: lead.lead_status.color,
                      color: lead.lead_status.color 
                    }}
                    variant="outline"
                  >
                    {lead.lead_status.name}
                  </Badge>
                )}
                <TemperatureBadge temperature={lead.temperature} size="sm" />
                <OriginBadge origem={lead.origem} size="sm" />
              </div>
            </div>
          </div>
          {/* Quick action buttons */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[#a6c8e1] hover:text-white hover:bg-white/5"
              onClick={() => {
                const phone = lead.phone.replace(/\D/g, '');
                const full = phone.startsWith('55') ? phone : `55${phone}`;
                window.open(`https://wa.me/${full}`, '_blank');
              }}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[#a6c8e1] hover:text-white hover:bg-white/5"
              onClick={() => window.open(`tel:${lead.phone}`, '_self')}
            >
              <Phone className="h-4 w-4" />
              Ligar
            </Button>
            {lead.interesse && (
              <span className="text-xs text-[#a6c8e1] ml-auto truncate max-w-[150px]">
                {lead.interesse}
              </span>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="border-b px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4" />
              Detalhes
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'whatsapp'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
          </div>
        </div>

        {/* WhatsApp tab content */}
        {activeTab === 'whatsapp' && (
          <div className="flex-1 overflow-hidden">
            {whatsappConversation ? (
              <ChatView
                conversation={whatsappConversation}
                messages={whatsappMessages}
                loading={whatsappMessagesLoading}
                onSend={async (text) => {
                  const result = await sendWhatsAppMessage(text, fullPhone, lead.id);
                  return result;
                }}
                onBack={() => setActiveTab('details')}
                onShowLead={() => {}}
                isMobile={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}
          </div>
        )}

        {/* Detalhes tab content */}
        {activeTab === 'details' && (
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Alerta de Lead Recorrente */}
          {lead.is_duplicate && duplicateLeadInfo && (
            <>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold text-amber-600 dark:text-amber-400">Lead Recorrente</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Este lead já entrou anteriormente no sistema. Veja os dados do registro anterior:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="text-sm font-medium">{duplicateLeadInfo.name}</p>
                  </div>
                  <div className="p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground">Status anterior</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {duplicateLeadInfo.status_color && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: duplicateLeadInfo.status_color }} />
                      )}
                      <p className="text-sm font-medium">{duplicateLeadInfo.status_name || '-'}</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground">Temperatura</p>
                    <TemperatureBadge temperature={duplicateLeadInfo.temperature} size="sm" />
                  </div>
                  <div className="p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground">Corretor</p>
                    <p className="text-sm font-medium">{duplicateLeadInfo.broker_name || 'Não atribuído'}</p>
                  </div>
                  <div className="p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground">Entrada anterior</p>
                    <p className="text-sm font-medium">
                      {new Date(duplicateLeadInfo.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground">Última atualização</p>
                    <p className="text-sm font-medium">
                      {new Date(duplicateLeadInfo.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                {duplicateLeadInfo.observacoes && (
                  <div className="mt-3 p-2.5 rounded-md bg-background/60">
                    <p className="text-xs text-muted-foreground mb-1">Observações anteriores</p>
                    <p className="text-sm">{duplicateLeadInfo.observacoes}</p>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Alerta de WhatsApp desconectado */}
          {whatsappDisconnected && (
            <>
              <Alert className="border-muted-foreground/20 bg-muted/50 text-foreground [&>svg]:text-muted-foreground">
                <WifiOff className="h-5 w-5" />
                <AlertTitle className="font-semibold">
                  WhatsApp desconectado
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  O número do WhatsApp está desconectado. Conecte o WhatsApp nas configurações para enviar mensagens.
                </AlertDescription>
              </Alert>
              <Separator />
            </>
          )}

          {/* Alerta de falha no WhatsApp (apenas quando conectado) */}
          {whatsappFailure && !whatsappDisconnected && (
            <>
              <Alert variant="destructive" className="border-amber-500/30 bg-amber-500/10 text-foreground [&>svg]:text-amber-500">
                <MessageSquareWarning className="h-5 w-5" />
                <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
                  Falha no envio de WhatsApp
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  {whatsappFailure.toLowerCase().includes('não existe no whatsapp') || whatsappFailure.toLowerCase().includes('não possui whatsapp') || whatsappFailure.toLowerCase().includes('failed to send')
                    ? 'Este número não existe no WhatsApp. Verifique o telefone do lead.'
                    : whatsappFailure}
                </AlertDescription>
              </Alert>
              <Separator />
            </>
          )}

          {/* Alerta de mensagem programada */}
          {scheduledMessage && (
            <>
              <Alert className="border-primary/30 bg-primary/10 text-foreground [&>svg]:text-primary">
                <Timer className="h-5 w-5" />
                <AlertTitle className="font-semibold">
                  Mensagem programada
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  {scheduledMessage.rule_name || 'Mensagem automática'} — Envio em {formatScheduledTime(scheduledMessage.scheduled_for)}
                  {scheduledCount > 1 && (
                    <span className="block mt-1 text-xs">+{scheduledCount - 1} follow-up{scheduledCount - 1 > 1 ? 's' : ''} agendado{scheduledCount - 1 > 1 ? 's' : ''}</span>
                  )}
                </AlertDescription>
              </Alert>
              <Separator />
            </>
          )}

          {/* Informações de Contato */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Informações de Contato
            </h3>
            <div className="grid gap-3">
              <div 
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors group"
                onClick={() => copyToClipboard(lead.phone, 'Telefone')}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{formatPhone(lead.phone)}</p>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {lead.email && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors group"
                  onClick={() => copyToClipboard(lead.email!, 'Email')}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{lead.email}</p>
                  </div>
                  <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Origem e Campanha */}
          {(lead.origem || lead.campanha || lead.conjunto || lead.anuncio) && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Origem do Lead
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {lead.origem && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <MapPin className="h-4 w-4" />
                        <span className="text-xs">Origem</span>
                      </div>
                      <p className="font-medium text-sm">{lead.origem}</p>
                    </div>
                  )}
                  {lead.campanha && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Megaphone className="h-4 w-4" />
                        <span className="text-xs">Campanha</span>
                      </div>
                      <p className="font-medium text-sm">{lead.campanha}</p>
                    </div>
                  )}
                  {lead.conjunto && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Target className="h-4 w-4" />
                        <span className="text-xs">Conjunto</span>
                      </div>
                      <p className="font-medium text-sm">{lead.conjunto}</p>
                    </div>
                  )}
                  {lead.anuncio && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <ExternalLink className="h-4 w-4" />
                        <span className="text-xs">Anúncio</span>
                      </div>
                      <p className="font-medium text-sm">{lead.anuncio}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Corretor e Imóvel Atribuídos */}
          {(brokerName || propertyInfo) && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Atribuição
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {brokerName && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <UserCheck className="h-4 w-4" />
                        <span className="text-xs">Corretor Responsável</span>
                      </div>
                      <p className="font-medium text-sm">{brokerName}</p>
                    </div>
                  )}
                  {propertyInfo && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Building2 className="h-4 w-4" />
                        <span className="text-xs">Imóvel de Interesse</span>
                      </div>
                      <p className="font-medium text-sm">
                        {propertyInfo.title}
                        {propertyInfo.city && ` - ${propertyInfo.city}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Dados do Formulário */}
          <LeadFormFields leadId={lead.id} />
          
          {/* Campos Personalizados (legacy) */}
          <LeadCustomFields leadId={lead.id} />
          <Separator />

          {/* Observações */}
          {lead.observacoes && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Observações
                </h3>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <p className="text-sm leading-relaxed">{lead.observacoes}</p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Motivo da Desqualificação */}
          {disqualificationData && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Motivo da Desqualificação
                </h3>
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {disqualificationData.reasons.map((reasonKey) => {
                      const reason = DISQUALIFICATION_REASONS.find(r => r.key === reasonKey);
                      return (
                        <Badge key={reasonKey} variant="outline" className="text-destructive border-destructive/30">
                          {reason?.label || reasonKey}
                        </Badge>
                      );
                    })}
                  </div>
                  {disqualificationData.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{disqualificationData.notes}</p>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Criado em</span>
              </div>
              <p className="text-sm font-medium">{createdAt.date}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {createdAt.time}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Atualizado em</span>
              </div>
              <p className="text-sm font-medium">{updatedAt.date}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {updatedAt.time}
              </p>
            </div>
          </div>

          <Separator />

          {/* Histórico de Atividades */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Atividades
            </h3>
            <LeadActivityTimeline leadId={lead.id} />
          </div>
        </div>
        )}

        {/* Footer com ações */}
        <div className="p-4 bg-muted/30 border-t flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit(lead);
            }}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar Lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailModal;
