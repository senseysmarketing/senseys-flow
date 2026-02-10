import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageCircle, Wifi, WifiOff, QrCode, RefreshCw, Loader2, Clock, Zap, AlertCircle, Settings2, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { WhatsAppTemplatesModal } from './WhatsAppTemplatesModal';

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

const DELAY_OPTIONS = [
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
  { value: 2880, label: '48 horas' },
  { value: 4320, label: '72 horas' },
];

export function WhatsAppIntegrationSettings() {
  const { user } = useAuth();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [pendingAutoCreate, setPendingAutoCreate] = useState(false);
  const [followUpSteps, setFollowUpSteps] = useState<FollowUpStep[]>([]);

  const fetchSession = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setSession(data);
      
      // Sempre verificar status real na Evolution API quando mostrar como conectado
      if (data.status === 'connected') {
        try {
          const response = await supabase.functions.invoke('whatsapp-connect?action=status');
          
          // Se API diz desconectado mas banco dizia conectado, atualizar UI e alertar
          if (response.data && !response.data.connected) {
            setSession(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
            toast({
              variant: 'destructive',
              title: 'WhatsApp Desconectado',
              description: 'A conexão com o WhatsApp foi perdida. Reconecte para continuar enviando mensagens.',
            });
          } else if (response.data?.phoneNumber && !data.phone_number) {
            // Atualizar estado local com o número se não tiver
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

  const fetchFollowUpSteps = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_followup_steps' as any)
      .select('*')
      .order('position');
    
    setFollowUpSteps((data || []) as unknown as FollowUpStep[]);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSession(), fetchTemplates(), fetchAutomationRules(), fetchFollowUpSteps()]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user, fetchSession, fetchTemplates, fetchAutomationRules, fetchFollowUpSteps]);

  // Poll for status updates when connecting
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (pollingActive && showQRModal) {
      interval = setInterval(async () => {
        // Use query params via GET simulation
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        
        if (response.data?.connected || response.data?.status === 'connected') {
          setPollingActive(false);
          setShowQRModal(false);
          fetchSession();
          toast({
            title: 'WhatsApp Conectado!',
            description: 'Seu WhatsApp foi conectado com sucesso.',
          });
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pollingActive, showQRModal, fetchSession]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Create instance
      const createResponse = await supabase.functions.invoke('whatsapp-connect?action=create-instance');
      
      if (createResponse.error) {
        throw new Error(createResponse.error.message);
      }

      if (createResponse.data?.status === 'connected') {
        toast({
          title: 'Já Conectado',
          description: 'Seu WhatsApp já está conectado.',
        });
        fetchSession();
        return;
      }

      // Get QR code
      setShowQRModal(true);
      await refreshQRCode();
      setPollingActive(true);
    } catch (error: any) {
      console.error('Error connecting:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível conectar ao WhatsApp.',
      });
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
        toast({
          title: 'WhatsApp Conectado!',
          description: 'Seu WhatsApp foi conectado com sucesso.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível gerar o QR Code. Tente novamente.',
        });
      }
    } catch (error: any) {
      console.error('Error getting QR code:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível gerar o QR Code.',
      });
    } finally {
      setQrLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase.functions.invoke('whatsapp-connect?action=disconnect');
      setSession(null);
      toast({
        title: 'Desconectado',
        description: 'WhatsApp desconectado com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível desconectar.',
      });
    }
  };

  const handleAutomationToggle = async (ruleId: string, isActive: boolean) => {
    try {
      await supabase
        .from('whatsapp_automation_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);
      
      fetchAutomationRules();
      toast({
        title: 'Atualizado',
        description: `Automação ${isActive ? 'ativada' : 'desativada'}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a automação.',
      });
    }
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
      toast({
        title: 'Automação Criada',
        description: 'Regra de saudação automática criada com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível criar a automação.',
      });
    }
  };

  const updateRuleTemplate = async (ruleId: string, templateId: string) => {
    try {
      await supabase
        .from('whatsapp_automation_rules')
        .update({ template_id: templateId })
        .eq('id', ruleId);
      
      fetchAutomationRules();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o template.',
      });
    }
  };

  const updateRuleDelay = async (ruleId: string, delaySeconds: number) => {
    try {
      await supabase
        .from('whatsapp_automation_rules')
        .update({ delay_seconds: delaySeconds })
        .eq('id', ruleId);
      
      fetchAutomationRules();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o delay.',
      });
    }
  };

  const updateRuleSources = async (ruleId: string, sources: TriggerSources) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase
        .from('whatsapp_automation_rules')
        .update({ trigger_sources: sources } as any)
        .eq('id', ruleId);
      
      fetchAutomationRules();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar as fontes.',
      });
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
      {/* Connection Card */}
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
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {session?.phone_number && <span>Número: {session.phone_number}</span>}
                {session?.connected_at && (
                  <span className="ml-4">
                    Conectado desde: {new Date(session.connected_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <WifiOff className="h-4 w-4 mr-2" />
                    Desconectar
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
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Automations Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Automações</CardTitle>
                <CardDescription>Configure mensagens automáticas para seus leads</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Conecte seu WhatsApp para ativar as automações
            </div>
          )}

          {/* New Lead Greeting Rule */}
          {newLeadRule ? (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={newLeadRule.is_active}
                    onCheckedChange={(checked) => handleAutomationToggle(newLeadRule.id, checked)}
                    disabled={!isConnected}
                  />
                  <div>
                    <Label className="font-medium">Saudação Automática</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar mensagem quando novo lead entrar
                    </p>
                  </div>
                </div>
              </div>

              {newLeadRule.is_active && (
                <div className="space-y-4 pl-12">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Template de Mensagem</Label>
                      <Select
                        value={newLeadRule.template_id || ''}
                        onValueChange={(value) => updateRuleTemplate(newLeadRule.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => setShowTemplatesModal(true)}
                      >
                        <Settings2 className="h-3 w-3 mr-1" />
                        Personalizar Templates
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Delay</Label>
                      <Select
                        value={String(newLeadRule.delay_seconds)}
                        onValueChange={(value) => updateRuleDelay(newLeadRule.id, parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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

                  <div className="space-y-3 pt-2 border-t">
                    <Label>Enviar para leads de:</Label>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="source-manual"
                          checked={newLeadRule.trigger_sources?.manual !== false}
                          onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
                            manual: !!checked,
                            meta: newLeadRule.trigger_sources?.meta !== false,
                            webhook: newLeadRule.trigger_sources?.webhook !== false,
                          })}
                        />
                        <Label htmlFor="source-manual" className="font-normal cursor-pointer">Cadastro Manual</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="source-meta"
                          checked={newLeadRule.trigger_sources?.meta !== false}
                          onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
                            manual: newLeadRule.trigger_sources?.manual !== false,
                            meta: !!checked,
                            webhook: newLeadRule.trigger_sources?.webhook !== false,
                          })}
                        />
                        <Label htmlFor="source-meta" className="font-normal cursor-pointer">Meta Ads</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="source-webhook"
                          checked={newLeadRule.trigger_sources?.webhook !== false}
                          onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
                            manual: newLeadRule.trigger_sources?.manual !== false,
                            meta: newLeadRule.trigger_sources?.meta !== false,
                            webhook: !!checked,
                          })}
                        />
                        <Label htmlFor="source-webhook" className="font-normal cursor-pointer">Webhook</Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => createNewLeadRule()}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Configurar Saudação Automática
            </Button>
          )}

          {/* Follow-up Section - only show when greeting rule exists */}
          {newLeadRule && newLeadRule.is_active && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="font-medium">Follow-up Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar mensagens de acompanhamento para leads que não responderam
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {followUpSteps.map((step) => (
                  <div key={step.id} className="p-3 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={step.is_active}
                          onCheckedChange={async (checked) => {
                            await supabase
                              .from('whatsapp_followup_steps' as any)
                              .update({ is_active: checked } as any)
                              .eq('id', step.id);
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
                          await supabase
                            .from('whatsapp_followup_steps' as any)
                            .delete()
                            .eq('id', step.id);
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
                              await supabase
                                .from('whatsapp_followup_steps' as any)
                                .update({ template_id: value } as any)
                                .eq('id', step.id);
                              fetchFollowUpSteps();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Delay</Label>
                          <Select
                            value={String(step.delay_minutes)}
                            onValueChange={async (value) => {
                              await supabase
                                .from('whatsapp_followup_steps' as any)
                                .update({ delay_minutes: parseInt(value) } as any)
                                .eq('id', step.id);
                              fetchFollowUpSteps();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
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
                  disabled={templates.length === 0}
                  onClick={async () => {
                    if (templates.length === 0) {
                      setShowTemplatesModal(true);
                      return;
                    }
                    const { data: accountData } = await supabase.rpc('get_user_account_id');
                    await supabase.from('whatsapp_followup_steps' as any).insert({
                      account_id: accountData,
                      name: `Follow-up ${followUpSteps.length + 1}`,
                      template_id: templates[0].id,
                      delay_minutes: followUpSteps.length === 0 ? 60 : followUpSteps.length === 1 ? 1440 : 4320,
                      position: followUpSteps.length,
                      is_active: true,
                    } as any);
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
            </div>
          )}

        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
            <div>
              <p className="font-medium">Conecte seu WhatsApp</p>
              <p className="text-sm text-muted-foreground">Escaneie o QR Code com seu celular</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
            <div>
              <p className="font-medium">Configure as automações</p>
              <p className="text-sm text-muted-foreground">Defina quais mensagens enviar e quando</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
            <div>
              <p className="font-medium">Pronto!</p>
              <p className="text-sm text-muted-foreground">Novos leads receberão mensagens automaticamente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={(open) => {
        setShowQRModal(open);
        if (!open) setPollingActive(false);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu celular para conectar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>1. Abra o WhatsApp no seu celular</p>
              <p>2. Vá em <strong>Configurações &gt; Aparelhos conectados</strong></p>
              <p>3. Toque em <strong>Conectar um aparelho</strong></p>
              <p>4. Escaneie o código abaixo</p>
            </div>

            <div className="flex items-center justify-center p-4 bg-card rounded-lg border">
              {qrLoading ? (
                <div className="w-64 h-64 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : qrCode ? (
                <img 
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-muted-foreground">
                  QR Code não disponível
                </div>
              )}
            </div>

            <Button 
              variant="outline" 
              onClick={refreshQRCode} 
              disabled={qrLoading}
              className="w-full"
            >
              {qrLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Gerar Novo QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates Management Modal */}
      <WhatsAppTemplatesModal
        open={showTemplatesModal}
        onOpenChange={(open) => {
          setShowTemplatesModal(open);
          if (!open && pendingAutoCreate) {
            setPendingAutoCreate(false);
            // Recarregar templates e criar regra automaticamente
            (async () => {
              const { data } = await supabase
                .from('whatsapp_templates')
                .select('id, name, template')
                .eq('is_active', true)
                .order('position')
                .limit(1);
              if (data && data.length > 0) {
                createNewLeadRule(data);
              }
            })();
          }
        }}
        onTemplatesChange={fetchTemplates}
      />
    </div>
  );
}
