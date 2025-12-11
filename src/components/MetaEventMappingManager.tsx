import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  Loader2, Send, RefreshCw, Info, CheckCircle, XCircle, 
  Wifi, WifiOff, Activity, AlertTriangle, Zap 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

interface EventMapping {
  id?: string;
  status_id: string;
  event_name: string;
  lead_type: string | null;
  is_active: boolean;
}

interface EventLog {
  id: string;
  event_name: string;
  status_code: number;
  sent_at: string;
  error_message: string | null;
  leads?: { name: string } | null;
}

interface MetaConfig {
  pixel_id: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
}

interface EventStats {
  total: number;
  success: number;
  failed: number;
  successRate: number;
}

const META_EVENTS = [
  { value: "Lead", label: "Lead", description: "Lead gerado (padrão)" },
  { value: "Contact", label: "Contact", description: "Entrou em contato" },
  { value: "Schedule", label: "Schedule", description: "Agendou visita" },
  { value: "SubmitApplication", label: "SubmitApplication", description: "Enviou proposta" },
  { value: "Purchase", label: "Purchase", description: "Compra/Venda realizada" },
  { value: "CompleteRegistration", label: "CompleteRegistration", description: "Cadastro completo" },
];

const LEAD_TYPES = [
  { value: "__none__", label: "Nenhum" },
  { value: "qualified", label: "Qualificado" },
  { value: "converted", label: "Convertido" },
  { value: "disqualified", label: "Desqualificado" },
];

export default function MetaEventMappingManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSending, setTestingSending] = useState(false);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [mappings, setMappings] = useState<Record<string, EventMapping>>({});
  const [recentLogs, setRecentLogs] = useState<EventLog[]>([]);
  const [metaConfig, setMetaConfig] = useState<MetaConfig | null>(null);
  const [eventStats, setEventStats] = useState<EventStats>({ total: 0, success: 0, failed: 0, successRate: 0 });
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get user's account
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .single();

      if (!profile) throw new Error('Profile not found');
      setAccountId(profile.account_id);

      // Check if Meta is configured
      const { data: configData } = await supabase
        .from('account_meta_config')
        .select('pixel_id, ad_account_id, ad_account_name, is_active, last_sync_at')
        .eq('account_id', profile.account_id)
        .single();

      setMetaConfig(configData || null);

      // Fetch lead statuses
      const { data: statusData, error: statusError } = await supabase
        .from('lead_status')
        .select('id, name, color')
        .order('position');

      if (statusError) throw statusError;
      setStatuses(statusData || []);

      // Fetch existing mappings
      const { data: mappingData, error: mappingError } = await supabase
        .from('meta_event_mappings')
        .select('*');

      if (mappingError) throw mappingError;

      // Convert to lookup object
      const mappingsMap: Record<string, EventMapping> = {};
      (mappingData || []).forEach(m => {
        mappingsMap[m.status_id] = {
          id: m.id,
          status_id: m.status_id,
          event_name: m.event_name,
          lead_type: m.lead_type,
          is_active: m.is_active,
        };
      });
      setMappings(mappingsMap);

      // Fetch recent event logs with error details
      const { data: logData } = await supabase
        .from('meta_capi_events_log')
        .select('id, event_name, status_code, sent_at, error_message, leads:lead_id(name)')
        .order('sent_at', { ascending: false })
        .limit(20);

      setRecentLogs((logData || []) as EventLog[]);

      // Calculate stats from all logs
      const { data: allLogs } = await supabase
        .from('meta_capi_events_log')
        .select('status_code')
        .eq('account_id', profile.account_id);

      if (allLogs) {
        const total = allLogs.length;
        const success = allLogs.filter(l => l.status_code === 200).length;
        const failed = total - success;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
        setEventStats({ total, success, failed, successRate });
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (statusId: string, field: string, value: any) => {
    setMappings(prev => ({
      ...prev,
      [statusId]: {
        ...prev[statusId],
        status_id: statusId,
        [field]: value,
      } as EventMapping,
    }));
  };

  const saveMapping = async (statusId: string) => {
    const mapping = mappings[statusId];
    if (!mapping?.event_name) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um evento Meta",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .single();

      if (!profile) throw new Error('Profile not found');

      const payload = {
        account_id: profile.account_id,
        status_id: statusId,
        event_name: mapping.event_name,
        lead_type: mapping.lead_type === '__none__' ? null : mapping.lead_type,
        is_active: mapping.is_active ?? true,
      };

      if (mapping.id) {
        const { error } = await supabase
          .from('meta_event_mappings')
          .update(payload)
          .eq('id', mapping.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('meta_event_mappings')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setMappings(prev => ({
          ...prev,
          [statusId]: { ...prev[statusId], id: data.id },
        }));
      }

      toast({
        title: "Mapeamento salvo",
        description: "O evento Meta foi configurado para este status",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteMapping = async (statusId: string) => {
    const mapping = mappings[statusId];
    if (!mapping?.id) return;

    try {
      const { error } = await supabase
        .from('meta_event_mappings')
        .delete()
        .eq('id', mapping.id);

      if (error) throw error;

      setMappings(prev => {
        const updated = { ...prev };
        delete updated[statusId];
        return updated;
      });

      toast({
        title: "Mapeamento removido",
        description: "O evento Meta foi desvinculado deste status",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error.message,
      });
    }
  };

  const sendTestEvent = async () => {
    if (!accountId) return;

    setTestingSending(true);
    try {
      // Get a random lead to test with
      const { data: testLead } = await supabase
        .from('leads')
        .select('id, name')
        .eq('account_id', accountId)
        .limit(1)
        .single();

      if (!testLead) {
        toast({
          variant: "destructive",
          title: "Sem leads",
          description: "Crie pelo menos um lead para testar o envio de eventos",
        });
        return;
      }

      // Send test event
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/send-meta-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            lead_id: testLead.id,
            event_name: 'Lead',
            custom_data: { test: true, lead_event_source: 'Test Event' },
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Evento de teste enviado!",
          description: `Evento Lead enviado para o lead "${testLead.name}"`,
        });
        // Refresh logs
        fetchData();
      } else if (result.skipped) {
        toast({
          variant: "destructive",
          title: "Evento não enviado",
          description: result.message || "Pixel não configurado ou conta inativa",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao enviar",
          description: result.error || "Erro desconhecido",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao testar",
        description: error.message,
      });
    } finally {
      setTestingSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!metaConfig?.pixel_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Eventos Meta CAPI
          </CardTitle>
          <CardDescription>
            Configure o disparo automático de eventos para otimização de campanhas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 text-center text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Pixel não configurado</p>
            <p className="text-sm">
              Para usar os eventos CAPI, solicite à agência que configure o Pixel ID
              da sua conta de anúncios na configuração Meta.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status & Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Connection Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {metaConfig.is_active ? (
                <div className="p-2 rounded-full bg-green-500/20">
                  <Wifi className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-destructive/20">
                  <WifiOff className="h-5 w-5 text-destructive" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Status de Conexão</p>
                <p className="text-xs text-muted-foreground">
                  {metaConfig.is_active ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t space-y-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Pixel ID:</span> {metaConfig.pixel_id}
              </p>
              {metaConfig.ad_account_name && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Conta:</span> {metaConfig.ad_account_name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Events */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventStats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Eventos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventStats.successRate}%</p>
                <p className="text-xs text-muted-foreground">
                  Taxa de Sucesso ({eventStats.success} ok)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Failed Events */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${eventStats.failed > 0 ? 'bg-destructive/20' : 'bg-muted'}`}>
                <AlertTriangle className={`h-5 w-5 ${eventStats.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventStats.failed}</p>
                <p className="text-xs text-muted-foreground">Eventos com Erro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Button Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Testar Conexão
          </CardTitle>
          <CardDescription>
            Envie um evento de teste para verificar se a conexão com o Meta está funcionando
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={sendTestEvent} 
            disabled={testingSending}
            variant="outline"
          >
            {testingSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Evento de Teste
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Isso enviará um evento "Lead" de teste usando um lead existente da sua conta.
          </p>
        </CardContent>
      </Card>

      {/* Event Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Mapeamento de Eventos
          </CardTitle>
          <CardDescription>
            Configure qual evento Meta será disparado quando um lead mudar para cada status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status do Lead</TableHead>
                <TableHead>Evento Meta</TableHead>
                <TableHead>Tipo de Lead</TableHead>
                <TableHead className="w-[100px]">Ativo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map(status => {
                const mapping = mappings[status.id];
                return (
                  <TableRow key={status.id}>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        style={{ borderColor: status.color, color: status.color }}
                      >
                        {status.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping?.event_name || "__none__"}
                        onValueChange={(val) => 
                          handleMappingChange(status.id, 'event_name', val === "__none__" ? "" : val)
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecione um evento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum evento</SelectItem>
                          {META_EVENTS.map(event => (
                            <SelectItem key={event.value} value={event.value}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>{event.label}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{event.description}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping?.lead_type || "__none__"}
                        onValueChange={(val) => handleMappingChange(status.id, 'lead_type', val)}
                        disabled={!mapping?.event_name}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={mapping?.is_active ?? false}
                        onCheckedChange={(checked) => 
                          handleMappingChange(status.id, 'is_active', checked)
                        }
                        disabled={!mapping?.event_name}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveMapping(status.id)}
                          disabled={saving || !mapping?.event_name}
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                        </Button>
                        {mapping?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMapping(status.id)}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Events Log with Error Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Eventos Recentes</CardTitle>
            <CardDescription>Últimos eventos enviados para o Meta (com detalhes de erro)</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum evento enviado ainda</p>
              <p className="text-sm">
                Quando leads mudarem de status, os eventos aparecerão aqui.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.leads?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.event_name}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.status_code === 200 ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-600">Sucesso</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive">Erro {log.status_code}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(log.sent_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="cursor-help text-xs">
                                  Ver erro
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{log.error_message}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
