import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageCircle, Wifi, WifiOff, QrCode, RefreshCw, Loader2, Clock, Zap, AlertCircle, Settings2, Plus, Trash2, RotateCcw, GitBranch, Edit2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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

  const fetchSession = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setSession(data);
      
      if (data.status === 'connected') {
        try {
          const response = await supabase.functions.invoke('whatsapp-connect?action=status');
          
          if (response.error) {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError) {
              const retryResponse = await supabase.functions.invoke('whatsapp-connect?action=status');
              if (!retryResponse.error && retryResponse.data) {
                if (!retryResponse.data.connected) {
                  setSession(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
                } else if (retryResponse.data.phoneNumber && !data.phone_number) {
                  setSession(prev => prev ? { ...prev, phone_number: retryResponse.data.phoneNumber } : null);
                }
              }
            } else {
              toast({ variant: 'destructive', title: 'Sessão expirada', description: 'Faça login novamente para gerenciar o WhatsApp.' });
            }
            return;
          }
          
          if (response.data && !response.data.connected) {
            setSession(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
            toast({ variant: 'destructive', title: 'WhatsApp Desconectado', description: 'A conexão com o WhatsApp foi perdida. Reconecte para continuar enviando mensagens.' });
          } else if (response.data?.phoneNumber && response.data.phoneNumber !== data.phone_number) {
            setSession(prev => prev ? { ...prev, phone_number: response.data.phoneNumber } : null);
          }
        } catch (e) {
          console.log('Error checking real status:', e);
        }
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSession(), fetchTemplates(), fetchAutomationRules(), fetchGreetingRules(), fetchFollowUpSteps(), fetchSequenceCounts()]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user, fetchSession, fetchTemplates, fetchAutomationRules, fetchGreetingRules, fetchFollowUpSteps, fetchSequenceCounts]);

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
    <div className="space-y-6">
      {/* ─── SEÇÃO 1: Conexão ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10' : 'bg-muted'}`}>
                <MessageCircle className={`h-5 w-5 ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-lg">Conexão WhatsApp</CardTitle>
                <CardDescription>
                  {isConnected
                    ? 'Seu WhatsApp está conectado e pronto para enviar mensagens'
                    : 'Conecte seu WhatsApp para enviar mensagens diretamente do CRM'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex flex-col text-sm text-muted-foreground">
                {session?.phone_number && <span>Número: {session.phone_number}</span>}
                {session?.connected_at && (
                  <span>Conectado desde: {new Date(session.connected_at).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleForceReconfigure} disabled={reconfiguring}>
                  {reconfiguring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Reconfigurar Webhook
                </Button>
                <Button variant="outline" size="sm" onClick={handleRestartInstance} disabled={reconfiguring}>
                  {reconfiguring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Reiniciar Instância
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <WifiOff className="h-4 w-4 mr-2" />Desconectar
                    </Button>
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
              </div>
            </div>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Conectar WhatsApp
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── SEÇÃO 2: Saudação Automática ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Saudação Automática</CardTitle>
              <CardDescription>Mensagem enviada imediatamente quando um novo lead chegar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isConnected && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Conecte seu WhatsApp para ativar as automações
            </div>
          )}

          {newLeadRule ? (
            <>
              {/* Toggle global */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={newLeadRule.is_active}
                    onCheckedChange={(checked) => handleAutomationToggle(newLeadRule.id, checked)}
                    disabled={!isConnected}
                  />
                  <Label className="cursor-pointer font-medium">
                    {newLeadRule.is_active ? 'Saudação ativada' : 'Saudação desativada'}
                  </Label>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowTemplatesModal(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Personalizar Templates
                </Button>
              </div>

              {newLeadRule.is_active && (
                <>
                  {/* Default template + delay */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">Template Padrão (fallback)</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Template de Mensagem</Label>
                        <Select value={newLeadRule.template_id || ''} onValueChange={(value) => updateRuleTemplate(newLeadRule.id, value)}>
                          <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Delay de envio</Label>
                        <Select value={String(newLeadRule.delay_seconds)} onValueChange={(value) => updateRuleDelay(newLeadRule.id, parseInt(value))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Imediato</SelectItem>
                            <SelectItem value="30">30 segundos</SelectItem>
                            <SelectItem value="60">1 minuto</SelectItem>
                            <SelectItem value="300">5 minutos</SelectItem>
                            <SelectItem value="600">10 minutos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Sequence section */}
                    <div className="mt-3 p-3 border border-dashed rounded-lg space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
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
                            <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
                              ✓ Sequência ativa ({sequenceCounts[newLeadRule.id]} mensagens)
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleDisableSequence(newLeadRule.id)}
                            >
                              Desativar
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
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
                      <p className="text-xs text-muted-foreground">
                        Configure 2–5 mensagens enviadas em sequência em vez de uma única mensagem
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
                    <div className="flex flex-wrap gap-4">
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
                          <Label htmlFor={`source-${key}`} className="font-normal cursor-pointer">{label}</Label>
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
                          <span className="text-xs">Quando nenhuma regra casar, o template padrão acima será usado.</span>
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
                              <div className="flex items-center gap-2 flex-wrap pl-10">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
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
                                    <Badge className="gap-1 text-xs bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
                                      ✓ {sequenceCounts[rule.id]} msgs
                                    </Badge>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => handleDisableSequence(undefined, rule.id)}
                                    >
                                      Desativar
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
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

      {/* ─── SEÇÃO 3: Follow-up Automático ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <RotateCcw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Follow-up Automático</CardTitle>
              <CardDescription>Mensagens de acompanhamento para leads que não responderam</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Conecte seu WhatsApp para ativar os follow-ups
            </div>
          )}

          {!newLeadRule && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 border border-dashed rounded-lg text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Configure a saudação automática antes de ativar o follow-up
            </div>
          )}

          <div className="space-y-3">
            {followUpSteps.map((step, index) => (  // index used below for "Personalizar Templates"
              <div key={step.id} className="border rounded-lg bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={step.is_active}
                      onCheckedChange={async (checked) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (supabase.from('whatsapp_followup_steps' as any) as any).update({ is_active: checked }).eq('id', step.id);
                        fetchFollowUpSteps();
                      }}
                      disabled={!isConnected}
                    />
                    <Label className="font-medium">Etapa {step.position + 1}</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={async () => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await (supabase.from('whatsapp_followup_steps' as any) as any).delete().eq('id', step.id);
                      fetchFollowUpSteps();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {step.is_active && (
                  <div className="grid gap-4 sm:grid-cols-2 pl-12">
                    <div className="space-y-2">
                      <Label>Template de Mensagem</Label>
                      <Select
                        value={step.template_id}
                        onValueChange={async (value) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          await (supabase.from('whatsapp_followup_steps' as any) as any).update({ template_id: value }).eq('id', step.id);
                          fetchFollowUpSteps();
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {index === 0 && (
                        <Button variant="outline" size="sm" className="h-auto px-3 py-1.5 text-xs" onClick={() => setShowTemplatesModal(true)}>
                          <Settings2 className="h-3 w-3 mr-1" />Personalizar Templates
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Delay após etapa anterior</Label>
                      <Select
                        value={String(step.delay_minutes)}
                        onValueChange={async (value) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          await (supabase.from('whatsapp_followup_steps' as any) as any).update({ delay_minutes: parseInt(value) }).eq('id', step.id);
                          fetchFollowUpSteps();
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DELAY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
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
              Adicionar Etapa de Follow-up
            </Button>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Follow-ups são cancelados automaticamente quando o lead responde
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── SEÇÃO 4: Como Funciona ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">1</div>
            <div>
              <p className="text-sm font-medium">Novo lead chega</p>
              <p className="text-xs text-muted-foreground">Via cadastro manual, Meta Ads, Webhook ou Grupo OLX</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">2</div>
            <div>
              <p className="text-sm font-medium">Regras condicionais avaliadas</p>
              <p className="text-xs text-muted-foreground">Sistema verifica se alguma regra condicional (por imóvel, valor, tipo...) se aplica</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">3</div>
            <div>
              <p className="text-sm font-medium">Saudação enviada</p>
              <p className="text-xs text-muted-foreground">Template da regra condicional, ou o template padrão se nenhuma regra casar</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">4</div>
            <div>
              <p className="text-sm font-medium">Follow-up automático (opcional)</p>
              <p className="text-xs text-muted-foreground">Se o lead não responder, as etapas de follow-up são disparadas automaticamente</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
