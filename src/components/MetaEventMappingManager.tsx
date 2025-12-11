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
import { Loader2, Send, RefreshCw, Info, CheckCircle, XCircle } from "lucide-react";
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
  leads?: { name: string } | null;
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
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [mappings, setMappings] = useState<Record<string, EventMapping>>({});
  const [recentLogs, setRecentLogs] = useState<EventLog[]>([]);
  const [hasPixel, setHasPixel] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Check if pixel is configured
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .single();

      if (profile) {
        const { data: metaConfig } = await supabase
          .from('account_meta_config')
          .select('pixel_id')
          .eq('account_id', profile.account_id)
          .single();

        setHasPixel(!!metaConfig?.pixel_id);
      }

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

      // Fetch recent event logs
      const { data: logData } = await supabase
        .from('meta_capi_events_log')
        .select('id, event_name, status_code, sent_at, leads:lead_id(name)')
        .order('sent_at', { ascending: false })
        .limit(10);

      setRecentLogs((logData || []) as EventLog[]);

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
        // Update existing
        const { error } = await supabase
          .from('meta_event_mappings')
          .update(payload)
          .eq('id', mapping.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('meta_event_mappings')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        // Update local state with new ID
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasPixel) {
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

      {/* Recent Events Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Eventos Recentes</CardTitle>
            <CardDescription>Últimos eventos enviados para o Meta</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum evento enviado ainda
            </p>
          ) : (
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
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
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(log.sent_at).toLocaleString('pt-BR')}
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
