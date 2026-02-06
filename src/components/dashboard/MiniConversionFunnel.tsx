import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

interface MiniConversionFunnelProps {
  className?: string;
}

export const MiniConversionFunnel = ({ className }: MiniConversionFunnelProps) => {
  const { user } = useAuth();
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchFunnelData = async () => {
      setLoading(true);
      try {
        const [statusesResult, leadsResult] = await Promise.all([
          supabase
            .from("lead_status")
            .select("id, name, color, position")
            .order("position"),
          supabase
            .from("leads")
            .select("status_id"),
        ]);

        if (statusesResult.error) throw statusesResult.error;
        if (leadsResult.error) throw leadsResult.error;

        const statuses = statusesResult.data || [];
        const leads = leadsResult.data || [];
        const total = leads.length;

        setTotalLeads(total);

        // Count leads per status
        const countByStatus = leads.reduce((acc, lead) => {
          if (lead.status_id) {
            acc[lead.status_id] = (acc[lead.status_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const funnelStages: FunnelStage[] = statuses.map((status) => ({
          id: status.id,
          name: status.name,
          color: status.color,
          count: countByStatus[status.id] || 0,
          percentage: total > 0 ? Math.round(((countByStatus[status.id] || 0) / total) * 100) : 0,
        }));

        setStages(funnelStages);
      } catch (error) {
        console.error("Error fetching funnel data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFunnelData();
  }, [user]);

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <div className="h-6 bg-muted rounded w-36" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find closed stage for conversion rate
  const closedStage = stages.find((s) =>
    s.name.toLowerCase().includes("fechado") || s.name.toLowerCase().includes("vendido")
  );
  const conversionRate = closedStage?.percentage || 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            Funil de Conversão
          </div>
          {conversionRate > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {conversionRate}% conversão
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalLeads === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhum lead para exibir</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stages.map((stage, index) => {
              // Calculate width based on position in funnel (visual effect)
              const visualWidth = 100;
              

              return (
                <div key={stage.id} className="relative">
                  {/* Background bar (funnel shape) */}
                  <div
                    className="h-9 rounded-lg bg-muted/50 transition-all mx-auto"
                    style={{ width: `${visualWidth}%` }}
                  >
                    {/* Filled portion based on actual count */}
                    <div
                      className="h-full rounded-lg transition-all flex items-center justify-between px-3"
                      style={{
                        backgroundColor: stage.color + "20",
                        width: "100%",
                      }}
                    >
                      <span className="text-xs font-medium truncate">{stage.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{stage.count}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({stage.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
