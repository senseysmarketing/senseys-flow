import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageCircle, WifiOff, QrCode, RefreshCw, Loader2, Clock, Zap, AlertCircle, Settings2, Plus, Trash2, RotateCcw, GitBranch, Edit2, MoreVertical, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { WhatsAppTemplatesModal } from './WhatsAppTemplatesModal';
import { GreetingRuleModal } from './GreetingRuleModal';
import { GreetingSequenceModal } from './GreetingSequenceModal';

interface WhatsAppSession {
  id: string;
  status: string;
  phone_number: string | null;
  instance_name: string;
  connected_at: string | null;
  qr_code: string | null;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
}

interface TriggerSources {
  manual?: boolean;
  meta?: boolean;
  webhook?: boolean;
  olx?: boolean;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  template_id: string | null;
  is_active: boolean;
  delay_seconds: number;
  trigger_sources?: TriggerSources | null;
}

interface FollowUpStep {
  id: string;
  account_id: string;
  name: string;
  template_id: string;
  delay_minutes: number;
  position: number;
  is_active: boolean;
}

interface GreetingRule {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  template_id: string | null;
  delay_seconds: number;
  condition_type: string;
  condition_property_id: string | null;
  condition_price_min: number | null;
  condition_price_max: number | null;
  condition_property_type: string | null;
  condition_transaction_type: string | null;
  condition_campaign: string | null;
  condition_origin: string | null;
}

const DELAY_OPTIONS = [
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
  { value: 2880, label: '48 horas' },
  { value: 4320, label: '72 horas' },
];

const CONDITION_TYPE_LABELS: Record<string, string> = {
  property: '🏠 Imóvel específico',
  price_range: '💰 Faixa de valor',
  property_type: '🏗️ Tipo de imóvel',
  transaction_type: '🔑 Tipo de transação',
  campaign: '📣 Campanha',
  origin: '📍 Origem',
};

const formatConditionSummary = (rule: GreetingRule): string => {
  switch (rule.condition_type) {
    case 'price_range': {
      const min = rule.condition_price_min ? `R$${(rule.condition_price_min/1000).toFixed(0)}k` : '';
      const max = rule.condition_price_max ? `R$${(rule.condition_price_max/1000).toFixed(0)}k` : '';
      return min && max ? `${min} – ${max}` : min || max || '';
    }
    case 'property_type': return rule.condition_property_type || '';
    case 'transaction_type': return rule.condition_transaction_type === 'sale' ? 'Venda' : rule.condition_transaction_type === 'rent' ? 'Aluguel' : '';
    case 'campaign': return rule.condition_campaign || '';
    case 'origin': {
      const labels: Record<string, string> = { manual: 'Manual', meta: 'Meta Ads', webhook: 'Webhook', olx: 'Grupo OLX' };
      return labels[rule.condition_origin || ''] || rule.condition_origin || '';
    }
    default: return '';
  }
};

export function WhatsAppIntegrationSettings() {
  const { user } = useAuth();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [greetingRules, setGreetingRules] = useState<GreetingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [pendingAutoCreate, setPendingAutoCreate] = useState(false);
  const [followUpSteps, setFollowUpSteps] = useState<FollowUpStep[]>([]);
  const [reconfiguring, setReconfiguring] = useState(false);
  const [showGreetingRuleModal, setShowGreetingRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<GreetingRule | null>(null);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceTarget, setSequenceTarget] = useState<{ automationRuleId?: string; greetingRuleId?: string; label: string } | null>(null);
  const [sequenceCounts, setSequenceCounts] = useState<Record<string, number>>({});

  // Sending schedule (business hours)
  const [sendingScheduleEnabled, setSendingScheduleEnabled] = useState(false);
  const [sendingScheduleStartHour, setSendingScheduleStartHour] = useState(8);
  const [sendingScheduleEndHour, setSendingScheduleEndHour] = useState(18);
  const [sendingScheduleAllowedDays, setSendingScheduleAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleDbId, setScheduleDbId] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const fetchSession = useCallback(async () => {
    if (!user) return;


    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setSession(data);
      
      // Always verify real status via Evolution API when a session exists,
      // not just when DB says 'connected'. This fixes stale 'connecting' states.
      try {
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        
        if (response.error) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError) {
            const retryResponse = await supabase.functions.invoke('whatsapp-connect?action=status');
            if (!retryResponse.error && retryResponse.data) {
              if (retryResponse.data.connected) {
                setSession(prev => prev ? { ...prev, status: 'connected', phone_number: retryResponse.data.phoneNumber || prev.phone_number } : null);
              } else if (data.status === 'connected') {
                // Only show disconnect toast on real transition from connected
                setSession(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
                toast({ variant: 'destructive', title: 'WhatsApp Desconectado', description: 'A conexão com o WhatsApp foi perdida. Reconecte para continuar enviando mensagens.' });
              } else {
                setSession(prev => prev ? { ...prev, status: 'disconnected' } : null);
              }
            }
          } else {
            toast({ variant: 'destructive', title: 'Sessão expirada', description: 'Faça login novamente para gerenciar o WhatsApp.' });
          }
          return;
        }
        
        if (response.data?.connected) {
          // Reconcile: Evolution says connected, update local state regardless of DB status
          setSession(prev => prev ? { ...prev, status: 'connected', phone_number: response.data.phoneNumber || prev.phone_number } : null);
        } else if (data.status === 'connected') {
          // Only show disconnect toast on real transition from connected -> disconnected
          setSession(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
          toast({ variant: 'destructive', title: 'WhatsApp Desconectado', description: 'A conexão com o WhatsApp foi perdida. Reconecte para continuar enviando mensagens.' });
        } else {
          setSession(prev => prev ? { ...prev, status: 'disconnected' } : null);
        }
      } catch (e) {
        console.log('Error checking real status:', e);
      }
    } else {
      setSession(null);
    }
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('id, name, template')
      .eq('is_active', true)
      .order('position');
    setTemplates(data || []);
  }, []);

  const fetchAutomationRules = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_automation_rules')
      .select('*')
      .order('created_at');
    
    setAutomationRules((data || []).map(rule => ({
      ...rule,
      trigger_sources: rule.trigger_sources as TriggerSources | null
    })));
  }, []);

  const fetchGreetingRules = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('whatsapp_greeting_rules' as any) as any)
      .select('*')
      .order('priority', { ascending: true });
    setGreetingRules((data || []) as GreetingRule[]);
  }, []);

  const fetchSequenceCounts = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('whatsapp_greeting_sequence_steps' as any) as any)
      .select('automation_rule_id, greeting_rule_id')
      .eq('is_active', true);
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const row of data) {
      const key = row.automation_rule_id || row.greeting_rule_id;
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    setSequenceCounts(counts);
  }, []);

  const handleDisableSequence = async (automationRuleId?: string, greetingRuleId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (supabase.from('whatsapp_greeting_sequence_steps' as any) as any)
      .update({ is_active: false });
    if (automationRuleId) await q.eq('automation_rule_id', automationRuleId);
    else if (greetingRuleId) await q.eq('greeting_rule_id', greetingRuleId);
    fetchSequenceCounts();
    toast({ title: 'Sequência desativada', description: 'As mensagens da sequência foram desativadas.' });
  };

  const handleDeleteSequence = async (automationRuleId?: string, greetingRuleId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (supabase.from('whatsapp_greeting_sequence_steps' as any) as any).delete();
    if (automationRuleId) await q.eq('automation_rule_id', automationRuleId);
    else if (greetingRuleId) await q.eq('greeting_rule_id', greetingRuleId);
    fetchSequenceCounts();
    toast({ title: 'Sequência excluída', description: 'As mensagens da sequência foram removidas.' });
  };

  const fetchFollowUpSteps = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('whatsapp_followup_steps' as any) as any)
      .select('*')
      .order('position');
    setFollowUpSteps((data || []) as FollowUpStep[]);
  }, []);

  const fetchSendingSchedule = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('whatsapp_sending_schedule' as any) as any)
      .select('*')
      .maybeSingle();
    if (data) {
      setScheduleDbId(data.id);
      setSendingScheduleEnabled(data.is_enabled);
      setSendingScheduleStartHour(data.start_hour);
      setSendingScheduleEndHour(data.end_hour);
      setSendingScheduleAllowedDays(data.allowed_days ?? [1, 2, 3, 4, 5]);
    }
  }, []);

  const saveSendingSchedule = async (patch: {
    is_enabled?: boolean;
    start_hour?: number;
    end_hour?: number;
    allowed_days?: number[];
  }) => {
    const payload = {
      is_enabled: sendingScheduleEnabled,
      start_hour: sendingScheduleStartHour,
      end_hour: sendingScheduleEndHour,
      allowed_days: sendingScheduleAllowedDays,
      ...patch,
    };
    setScheduleSaving(true);
    try {
      const { data: accountId } = await supabase.rpc('get_user_account_id');
      if (scheduleDbId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('whatsapp_sending_schedule' as any) as any)
          .update(payload)
          .eq('id', scheduleDbId);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newRow } = await (supabase.from('whatsapp_sending_schedule' as any) as any)
          .insert({ ...payload, account_id: accountId })
          .select('id')
          .single();
        if (newRow?.id) setScheduleDbId(newRow.id);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as configurações de horário.' });
    } finally {
      setScheduleSaving(false);
    }
  };

  useEffect(() => {

    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSession(), fetchTemplates(), fetchAutomationRules(), fetchGreetingRules(), fetchFollowUpSteps(), fetchSequenceCounts(), fetchSendingSchedule()]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user, fetchSession, fetchTemplates, fetchAutomationRules, fetchGreetingRules, fetchFollowUpSteps, fetchSequenceCounts, fetchSendingSchedule]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (pollingActive && showQRModal) {
      interval = setInterval(async () => {
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        if (response.error) return;
        
        if (response.data?.connected || response.data?.status === 'connected') {
          setPollingActive(false);
          setShowQRModal(false);
          fetchSession();
          toast({ title: 'WhatsApp Conectado!', description: 'Seu WhatsApp foi conectado com sucesso.' });
        }
      }, 3000);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [pollingActive, showQRModal, fetchSession]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const createResponse = await supabase.functions.invoke('whatsapp-connect?action=create-instance');
      if (createResponse.error) throw new Error(createResponse.error.message);

      if (createResponse.data?.status === 'connected') {
        toast({ title: 'Já Conectado', description: 'Seu WhatsApp já está conectado.' });
        fetchSession();
        return;
      }

      setShowQRModal(true);
      await refreshQRCode();
      setPollingActive(true);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível conectar ao WhatsApp.' });
    } finally {
      setConnecting(false);
    }
  };

  const refreshQRCode = async () => {
    setQrLoading(true);
    try {
      const response = await supabase.functions.invoke('whatsapp-connect?action=qr-code');
      
      if (response.data?.qrCode) {
        setQrCode(response.data.qrCode);
      } else if (response.data?.status === 'connected') {
        setShowQRModal(false);
        setPollingActive(false);
        fetchSession();
        toast({ title: 'WhatsApp Conectado!', description: 'Seu WhatsApp foi conectado com sucesso.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível gerar o QR Code. Tente novamente.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível gerar o QR Code.' });
    } finally {
      setQrLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase.functions.invoke('whatsapp-connect?action=disconnect');
      setSession(null);
      toast({ title: 'Desconectado', description: 'WhatsApp desconectado com sucesso.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desconectar.' });
    }
  };

  const handleAutomationToggle = async (ruleId: string, isActive: boolean) => {
    await supabase.from('whatsapp_automation_rules').update({ is_active: isActive }).eq('id', ruleId);
    fetchAutomationRules();
    toast({ title: 'Atualizado', description: `Automação ${isActive ? 'ativada' : 'desativada'}.` });
  };

  const createNewLeadRule = async (overrideTemplates?: WhatsAppTemplate[]) => {
    const availableTemplates = overrideTemplates || templates;
    if (!availableTemplates.length) {
      setPendingAutoCreate(true);
      setShowTemplatesModal(true);
      return;
    }

    try {
      const { data: accountData } = await supabase.rpc('get_user_account_id');
      await supabase.from('whatsapp_automation_rules').insert({
        account_id: accountData,
        name: 'Saudação para Novos Leads',
        trigger_type: 'new_lead',
        template_id: availableTemplates[0].id,
        is_active: true,
        delay_seconds: 0,
      });
      fetchAutomationRules();
      toast({ title: 'Automação Criada', description: 'Regra de saudação automática criada com sucesso.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a automação.' });
    }
  };

  const updateRuleTemplate = async (ruleId: string, templateId: string) => {
    await supabase.from('whatsapp_automation_rules').update({ template_id: templateId }).eq('id', ruleId);
    fetchAutomationRules();
  };

  const updateRuleDelay = async (ruleId: string, delaySeconds: number) => {
    await supabase.from('whatsapp_automation_rules').update({ delay_seconds: delaySeconds }).eq('id', ruleId);
    fetchAutomationRules();
  };

  const updateRuleSources = async (ruleId: string, sources: TriggerSources) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('whatsapp_automation_rules') as any).update({ trigger_sources: sources }).eq('id', ruleId);
    fetchAutomationRules();
  };

  const toggleGreetingRule = async (ruleId: string, isActive: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('whatsapp_greeting_rules' as any) as any).update({ is_active: isActive }).eq('id', ruleId);
    fetchGreetingRules();
  };

  const deleteGreetingRule = async (ruleId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('whatsapp_greeting_rules' as any) as any).delete().eq('id', ruleId);
    fetchGreetingRules();
    toast({ title: 'Regra removida' });
  };

  const handleForceReconfigure = async () => {
    setReconfiguring(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('account_id').single();
      if (profile?.account_id) {
        const response = await supabase.functions.invoke(`whatsapp-connect?action=force-reconfigure&account_id=${profile.account_id}`);
        if (response.data?.success) {
          toast({ title: 'Webhook reconfigurado!', description: 'As mensagens devem começar a chegar em instantes.' });
        } else {
          toast({ variant: 'destructive', title: 'Erro ao reconfigurar', description: response.data?.error || 'Não foi possível reconfigurar o webhook.' });
        }
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Falha ao reconfigurar webhook.' });
    } finally {
      setReconfiguring(false);
    }
  };

  const handleRestartInstance = async () => {
    setReconfiguring(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('account_id').single();
      if (profile?.account_id) {
        const response = await supabase.functions.invoke(`whatsapp-connect?action=restart-instance&account_id=${profile.account_id}`);
        if (response.data?.success) {
          toast({ title: 'Instância reiniciada!', description: 'O webhook foi reconfigurado. Mensagens devem chegar em instantes.' });
        } else {
          toast({ variant: 'destructive', title: 'Erro', description: response.data?.error || 'Falha ao reiniciar instância.' });
        }
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Falha ao reiniciar instância.' });
    } finally {
      setReconfiguring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = session?.status === 'connected';
  const newLeadRule = automationRules.find(r => r.trigger_type === 'new_lead');

  return (
    <div className="space-y-4">
      {/* ─── STATUS BAR / CONEXÃO ─── */}
      {isConnected ? (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Conectado</span>
            {session?.phone_number && (
              <span className="text-sm text-muted-foreground">· {session.phone_number}</span>
            )}
            {session?.connected_at && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                · desde {new Date(session.connected_at).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {reconfiguring ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleForceReconfigure} disabled={reconfiguring}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reconfigurar Webhook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRestartInstance} disabled={reconfiguring}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reiniciar Instância
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                    <WifiOff className="h-4 w-4 mr-2" />
                    Desconectar
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ao desconectar, as mensagens automáticas serão pausadas e você precisará escanear o QR Code novamente para reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Conexão WhatsApp</CardTitle>
                  <CardDescription>Conecte seu WhatsApp para enviar mensagens diretamente do CRM</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Desconectado
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Conectar WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── HORÁRIO DE ENVIO ─── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Horário de Envio</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {scheduleSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Switch
                checked={sendingScheduleEnabled}
                onCheckedChange={(checked) => {
                  setSendingScheduleEnabled(checked);
                  saveSendingSchedule({ is_enabled: checked });
                }}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            Restrinja o envio automático a dias e horários específicos (fuso: São Paulo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sendingScheduleEnabled ? (
            <p className="text-xs text-muted-foreground">
              Ative para definir uma janela de horário comercial. Mensagens fora do horário serão reagendadas para o próximo momento válido.
            </p>
          ) : (
            <>
              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Select
                    value={String(sendingScheduleStartHour)}
                    onValueChange={(v) => {
                      const h = parseInt(v);
                      setSendingScheduleStartHour(h);
                      saveSendingSchedule({ start_hour: h });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}h</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fim (exclusivo)</Label>
                  <Select
                    value={String(sendingScheduleEndHour)}
                    onValueChange={(v) => {
                      const h = parseInt(v);
                      setSendingScheduleEndHour(h);
                      saveSendingSchedule({ end_hour: h });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}h</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Days of week */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Dias permitidos</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_LABELS.map((label, idx) => {
                    const active = sendingScheduleAllowedDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? sendingScheduleAllowedDays.filter(d => d !== idx)
                            : [...sendingScheduleAllowedDays, idx].sort((a, b) => a - b);
                          setSendingScheduleAllowedDays(next);
                          saveSendingSchedule({ allowed_days: next });
                        }}
                        className={cn(
                          'h-8 w-10 rounded-md text-xs font-medium border transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              {(() => {
                const days = sendingScheduleAllowedDays.sort((a, b) => a - b);
                const dayNames = days.map(d => DAYS_LABELS[d]).join(', ');
                return days.length > 0 ? (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    📅 Envios de <strong>{dayNames}</strong>, das <strong>{String(sendingScheduleStartHour).padStart(2, '0')}h</strong> às <strong>{String(sendingScheduleEndHour).padStart(2, '0')}h</strong>
                  </p>
                ) : (
                  <p className="text-xs text-destructive">⚠️ Selecione ao menos um dia da semana</p>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── GRID 2 COLUNAS: Saudação + Follow-up ─── */}
      <div className="grid gap-4 lg:grid-cols-2">


        {/* COLUNA ESQUERDA: Saudação Automática */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Saudação Automática</CardTitle>
              </div>
              {newLeadRule && (
                <Switch
                  checked={newLeadRule.is_active}
                  onCheckedChange={(checked) => handleAutomationToggle(newLeadRule.id, checked)}
                  disabled={!isConnected}
                />
              )}
            </div>
            <CardDescription className="text-xs">Mensagem enviada quando um novo lead chegar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Conecte seu WhatsApp para ativar as automações
              </div>
            )}

            {newLeadRule ? (
              <>
                {newLeadRule.is_active && (
                  <>
                    {/* Default template + delay + templates button */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">Template Padrão (fallback)</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="grid gap-3">
                        <Select value={newLeadRule.template_id || ''} onValueChange={(value) => updateRuleTemplate(newLeadRule.id, value)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Select value={String(newLeadRule.delay_seconds)} onValueChange={(value) => updateRuleDelay(newLeadRule.id, parseInt(value))}>
                            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Imediato</SelectItem>
                              <SelectItem value="30">30 segundos</SelectItem>
                              <SelectItem value="60">1 minuto</SelectItem>
                              <SelectItem value="300">5 minutos</SelectItem>
                              <SelectItem value="600">10 minutos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowTemplatesModal(true)}>
                          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                          Personalizar Templates
                        </Button>
                      </div>
                      {/* Sequence section */}
                      <div className="p-3 border border-dashed rounded-lg space-y-2">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-3"
                            onClick={() => {
                              setSequenceTarget({ automationRuleId: newLeadRule.id, label: 'Template Padrão (fallback)' });
                              setShowSequenceModal(true);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-2" />
                            {sequenceCounts[newLeadRule.id] ? 'Editar Sequência' : 'Configurar Sequência'}
                          </Button>
                          {sequenceCounts[newLeadRule.id] ? (
                            <>
                              <Badge className="gap-1 h-8 rounded-md px-3 text-xs flex items-center bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
                                ✓ {sequenceCounts[newLeadRule.id]} msgs
                              </Badge>
                              <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => handleDisableSequence(newLeadRule.id)}>
                                Desativar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir sequência?</AlertDialogTitle>
                                    <AlertDialogDescription>Todas as mensagens da sequência serão removidas permanentemente.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSequence(newLeadRule.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          Configure 2–5 mensagens enviadas em sequência
                        </p>
                      </div>
                    </div>

                    {/* Sources */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">Enviar para leads de</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center">
                        {[
                          { key: 'manual', label: 'Cadastro Manual' },
                          { key: 'meta', label: 'Meta Ads' },
                          { key: 'webhook', label: 'Webhook' },
                          { key: 'olx', label: 'Grupo OLX' },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <Checkbox
                              id={`source-${key}`}
                              checked={(newLeadRule.trigger_sources as Record<string, boolean> | null)?.[key] !== false}
                              onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
                                ...newLeadRule.trigger_sources,
                                [key]: !!checked,
                              })}
                            />
                            <Label htmlFor={`source-${key}`} className="font-normal cursor-pointer text-xs">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conditional Rules */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">Regras Condicionais</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      <div className="space-y-2 mb-3">
                        {greetingRules.length === 0 ? (
                          <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                            <GitBranch className="h-5 w-5 mx-auto mb-2 opacity-40" />
                            Nenhuma regra condicional criada.<br />
                            <span className="text-xs">O template padrão acima será usado.</span>
                          </div>
                        ) : (
                          greetingRules.map((rule) => {
                            const templateName = templates.find(t => t.id === rule.template_id)?.name;
                            const summary = formatConditionSummary(rule);
                            return (
                              <div key={rule.id} className="flex flex-col gap-2 p-2.5 border rounded-lg bg-muted/20">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={rule.is_active}
                                    onCheckedChange={(v) => toggleGreetingRule(rule.id, v)}
                                    disabled={!isConnected}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal">
                                        #{rule.priority}
                                      </Badge>
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {CONDITION_TYPE_LABELS[rule.condition_type]}
                                      </span>
                                      {summary && (
                                        <span className="text-xs text-foreground truncate">{summary}</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {rule.name} {templateName ? `→ ${templateName}` : ''}
                                    </p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setEditingRule(rule); setShowGreetingRuleModal(true); }}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover regra?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta regra de saudação será removida permanentemente.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteGreetingRule(rule.id)}>Remover</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                                {/* Sequence row for conditional rule */}
                                <div className="flex items-center justify-center gap-2 flex-wrap pl-10">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs px-3"
                                    onClick={() => {
                                      setSequenceTarget({ greetingRuleId: rule.id, label: rule.name });
                                      setShowSequenceModal(true);
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3 mr-1.5" />
                                    {sequenceCounts[rule.id] ? 'Editar Sequência' : 'Configurar Sequência'}
                                  </Button>
                                  {sequenceCounts[rule.id] ? (
                                    <>
                                      <Badge className="gap-1 h-8 rounded-md px-3 text-xs flex items-center bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
                                        ✓ {sequenceCounts[rule.id]} msgs
                                      </Badge>
                                      <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => handleDisableSequence(undefined, rule.id)}>
                                        Desativar
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Excluir sequência?</AlertDialogTitle>
                                            <AlertDialogDescription>As mensagens da sequência desta regra serão removidas permanentemente.</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteSequence(undefined, rule.id)}>Excluir</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => { setEditingRule(null); setShowGreetingRuleModal(true); }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Regra Condicional
                      </Button>

                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        As regras são avaliadas em ordem de prioridade. O template padrão é usado quando nenhuma regra casar.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <Button variant="outline" onClick={() => createNewLeadRule()} className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Configurar Saudação Automática
              </Button>
            )}
          </CardContent>
        </Card>

        {/* COLUNA DIREITA: Follow-up Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Follow-up Automático</CardTitle>
            </div>
            <CardDescription className="text-xs">Mensagens para leads que não responderam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isConnected && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Conecte seu WhatsApp para ativar os follow-ups
              </div>
            )}

            {!newLeadRule && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 border border-dashed rounded-lg text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Configure a saudação antes de ativar o follow-up
              </div>
            )}

            {/* Timeline stepper */}
            <div className="relative">
              <AnimatePresence initial={false}>
              {followUpSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3 pb-4 relative"
                >
                  {index < followUpSteps.length - 1 && (
                    <div className={cn(
                      "absolute left-[7px] top-4 bottom-0 w-0.5 transition-colors",
                      step.is_active ? "bg-[#a6c8e1]/30" : "bg-white/10"
                    )} />
                  )}
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 z-10 transition-all",
                    step.is_active ? "bg-[#81afd1] border-[#81afd1] shadow-[0_0_8px_rgba(129,175,209,0.4)]" : "bg-[#5a5f65] border-white/20"
                  )} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Etapa {step.position + 1}</span>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={step.is_active}
                          onCheckedChange={async (checked) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (supabase.from('whatsapp_followup_steps' as any) as any).update({ is_active: checked }).eq('id', step.id);
                            fetchFollowUpSteps();
                          }}
                          disabled={!isConnected}
                          className="data-[state=checked]:bg-[#81afd1] data-[state=checked]:shadow-[0_0_8px_rgba(129,175,209,0.4)]"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-white/5"
                          onClick={async () => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (supabase.from('whatsapp_followup_steps' as any) as any).delete().eq('id', step.id);
                            fetchFollowUpSteps();
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {step.is_active && (
                      <div className="space-y-2 p-3 rounded-xl bg-[#5a5f65] border border-white/10">
                        <Select
                          value={step.template_id}
                          onValueChange={async (value) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (supabase.from('whatsapp_followup_steps' as any) as any).update({ template_id: value }).eq('id', step.id);
                            fetchFollowUpSteps();
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-[#a6c8e1] shrink-0" />
                          <Select
                            value={String(step.delay_minutes)}
                            onValueChange={async (value) => {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              await (supabase.from('whatsapp_followup_steps' as any) as any).update({ delay_minutes: parseInt(value) }).eq('id', step.id);
                              fetchFollowUpSteps();
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DELAY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {index === 0 && (
                          <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={() => setShowTemplatesModal(true)}>
                            <Settings2 className="h-3 w-3 mr-1.5" />Personalizar Templates
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1"
                disabled={templates.length === 0 || !newLeadRule}
                onClick={async () => {
                  if (templates.length === 0) { setShowTemplatesModal(true); return; }
                  const { data: accountData } = await supabase.rpc('get_user_account_id');
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (supabase.from('whatsapp_followup_steps' as any) as any).insert({
                    account_id: accountData,
                    name: `Follow-up ${followUpSteps.length + 1}`,
                    template_id: templates[0].id,
                    delay_minutes: followUpSteps.length === 0 ? 60 : followUpSteps.length === 1 ? 1440 : 4320,
                    position: followUpSteps.length,
                    is_active: true,
                  });
                  fetchFollowUpSteps();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Etapa
              </Button>

              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                <AlertCircle className="h-3 w-3" />
                Cancelados automaticamente quando o lead responde
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── COMO FUNCIONA — Collapsible no rodapé ─── */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1">
          <ChevronDown className="h-3.5 w-3.5" />
          Como funciona a automação?
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 p-4 border rounded-lg space-y-3">
            {[
              { n: 1, title: 'Novo lead chega', desc: 'Via cadastro manual, Meta Ads, Webhook ou Grupo OLX' },
              { n: 2, title: 'Regras condicionais avaliadas', desc: 'Sistema verifica se alguma regra condicional (por imóvel, valor, tipo...) se aplica' },
              { n: 3, title: 'Saudação enviada', desc: 'Template da regra condicional, ou o template padrão se nenhuma regra casar' },
              { n: 4, title: 'Follow-up automático (opcional)', desc: 'Se o lead não responder, as etapas de follow-up são disparadas automaticamente' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{n}</div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* QR Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escanear QR Code</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular, vá em Dispositivos Conectados e escaneie o QR Code
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrLoading ? (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrCode ? (
              <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg border" />
            ) : null}
            <Button variant="outline" onClick={refreshQRCode} disabled={qrLoading} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Gerar novo QR Code
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              O QR Code expira em alguns minutos. Gere um novo se necessário.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates Modal */}
      <WhatsAppTemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
        onTemplatesChange={() => {
          fetchTemplates();
          if (pendingAutoCreate) {
            setPendingAutoCreate(false);
            supabase.from('whatsapp_templates').select('id, name, template').eq('is_active', true).order('position').then(({ data }) => {
              if (data && data.length > 0) createNewLeadRule(data as WhatsAppTemplate[]);
            });
          }
        }}
      />

      {/* Greeting Rule Modal */}
      <GreetingRuleModal
        open={showGreetingRuleModal}
        onClose={() => { setShowGreetingRuleModal(false); setEditingRule(null); }}
        onSaved={fetchGreetingRules}
        templates={templates}
        editRule={editingRule}
      />

      {/* Greeting Sequence Modal */}
      <GreetingSequenceModal
        open={showSequenceModal}
        onClose={() => { setShowSequenceModal(false); setSequenceTarget(null); }}
        onSaved={fetchSequenceCounts}
        templates={templates}
        automationRuleId={sequenceTarget?.automationRuleId}
        greetingRuleId={sequenceTarget?.greetingRuleId}
        ruleLabel={sequenceTarget?.label}
      />
    </div>
  );
}
