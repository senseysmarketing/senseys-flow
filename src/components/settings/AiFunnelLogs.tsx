import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, ArrowRight, Minus, AlertTriangle } from "lucide-react";

interface AiFunnelLog {
  id: string;
  lead_id: string;
  ai_summary: string;
  action_taken: string;
  messages_analyzed: number;
  created_at: string;
  previous_status: { name: string; color: string } | null;
  new_status: { name: string; color: string } | null;
  lead: { name: string } | null;
}

export const AiFunnelLogs = () => {
  const { account } = useAccount();
  const [logs, setLogs] = useState<AiFunnelLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.id) return;
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("ai_funnel_logs")
        .select(`
          id,
          lead_id,
          ai_summary,
          action_taken,
          messages_analyzed,
          created_at,
          previous_status:lead_status!ai_funnel_logs_previous_status_id_fkey(name, color),
          new_status:lead_status!ai_funnel_logs_new_status_id_fkey(name, color),
          lead:leads!ai_funnel_logs_lead_id_fkey(name)
        `)
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setLogs(data as any);
      }
      setLoading(false);
    };
    fetchLogs();
  }, [account?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Brain className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhum log de IA ainda</p>
        <p className="text-xs mt-1">Ative a IA de Funil nas configurações para começar</p>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "advanced":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">Avançou</Badge>;
      case "no_change":
        return <Badge variant="secondary" className="text-xs">Sem mudança</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-xs">Erro</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{action}</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "advanced":
        return <ArrowRight className="h-4 w-4 text-emerald-500" />;
      case "no_change":
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Brain className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {logs.map((log) => {
          const date = new Date(log.created_at);
          return (
            <div key={log.id} className="flex gap-3 p-3 rounded-lg border bg-card">
              <div className="flex-shrink-0 mt-0.5">
                {getActionIcon(log.action_taken)}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {(log.lead as any)?.name || "Lead removido"}
                  </span>
                  {getActionBadge(log.action_taken)}
                </div>
                
                {log.action_taken === "advanced" && log.previous_status && log.new_status && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className="px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: (log.previous_status as any)?.color }}
                    >
                      {(log.previous_status as any)?.name}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span
                      className="px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: (log.new_status as any)?.color }}
                    >
                      {(log.new_status as any)?.name}
                    </span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground line-clamp-2">{log.ai_summary}</p>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{log.messages_analyzed} msgs analisadas</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
