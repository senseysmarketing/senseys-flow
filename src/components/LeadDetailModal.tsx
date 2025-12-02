import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
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
  Copy,
  History
} from "lucide-react";
import WhatsAppMessagePopover from "@/components/WhatsAppMessagePopover";
import TemperatureBadge from "@/components/TemperatureBadge";
import LeadActivityTimeline from "@/components/LeadActivityTimeline";
import LeadCustomFields from "@/components/LeadCustomFields";
import { toast } from "@/hooks/use-toast";

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

const LeadDetailModal = ({ lead, open, onOpenChange, onEdit }: LeadDetailModalProps) => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Detalhes do Lead: {lead.name}</DialogTitle>
        </VisuallyHidden>
        {/* Header com gradiente */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 pb-8">
          {/* Status Badge */}
          {lead.lead_status && (
            <Badge 
              className="absolute top-4 right-4 px-3 py-1"
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

          {/* Nome e Avatar */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-foreground truncate">{lead.name}</h2>
              <div className="flex items-center gap-3 mt-2">
                <TemperatureBadge temperature={lead.temperature} size="sm" />
                {lead.interesse && (
                  <span className="text-sm text-muted-foreground truncate">
                    {lead.interesse}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
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

          {/* Campos Personalizados */}
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

        {/* Footer com ações */}
        <div className="p-4 bg-muted/30 border-t flex items-center justify-end gap-3">
          <WhatsAppMessagePopover 
            phone={lead.phone} 
            leadName={lead.name}
            interesse={lead.interesse}
          >
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </WhatsAppMessagePopover>
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
