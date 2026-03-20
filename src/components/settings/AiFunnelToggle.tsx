import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Brain, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAccount } from "@/hooks/use-account";

export const AiFunnelToggle = () => {
  const { account, loading: accountLoading } = useAccount();
  const [enabled, setEnabled] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.id) return;
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("ai_funnel_enabled, last_ai_funnel_run_at")
        .eq("id", account.id)
        .single();

      if (!error && data) {
        setEnabled(data.ai_funnel_enabled ?? false);
        setLastRun(data.last_ai_funnel_run_at);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [account?.id]);

  const handleToggle = async (checked: boolean) => {
    if (!account?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ ai_funnel_enabled: checked })
      .eq("id", account.id);

    if (error) {
      toast.error("Erro ao atualizar configuração");
    } else {
      setEnabled(checked);
      toast.success(checked ? "IA de Funil ativada" : "IA de Funil desativada");
    }
    setSaving(false);
  };

  if (accountLoading || loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const formatLastRun = (date: string | null) => {
    if (!date) return "Nunca executado";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">IA de Avanço Automático</CardTitle>
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </div>
              <CardDescription className="mt-1">
                Analisa conversas do WhatsApp e avança leads no funil automaticamente
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-funnel-toggle" className="sr-only">
              Ativar IA de Funil
            </Label>
            <Switch
              id="ai-funnel-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Última execução: {formatLastRun(lastRun)}</span>
        </div>
        {enabled && (
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            A cada hora, a IA analisa conversas de leads em status intermediários e avança
            automaticamente no funil quando detecta progresso (visita agendada, proposta, etc).
            Todas as ações ficam registradas na timeline do lead.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
