import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import { 
  Users, 
  Flame,
  Calendar,
  DollarSign,
  Sparkles,
  Phone,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

// Dashboard sub-components (keep existing logic hooks)
import { useInsights } from "@/hooks/use-insights";
import { useLeadPriorities } from "@/hooks/use-lead-priorities";
import { BentoMetricCard } from "@/components/dashboard/BentoMetricCard";
import WhatsAppButton from "@/components/WhatsAppButton";

interface DashboardStats {
  leadsToday: number;
  hotLeads: number;
  followUps: number;
  vgv: number;
}

interface FunnelStage {
  name: string;
  count: number;
  color: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<DashboardStats>({ leadsToday: 0, hotLeads: 0, followUps: 0, vgv: 0 });
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const { insights } = useInsights();
  const { priorityLeads } = useLeadPriorities(3);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const [leadsResult, statusesResult, eventsResult] = await Promise.all([
        supabase.from("leads").select("id, temperature, created_at, status_id"),
        supabase.from("lead_status").select("id, name, color, position").order("position"),
        supabase.from("events").select("id, start_time")
          .gte("start_time", todayStart.toISOString())
          .lte("start_time", new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const leads = leadsResult.data || [];
      const statuses = statusesResult.data || [];
      const events = eventsResult.data || [];

      const leadsToday = leads.filter(l => new Date(l.created_at) >= todayStart).length;
      const hotLeads = leads.filter(l => l.temperature === "hot").length;
      const followUps = events.length;

      // VGV placeholder (could come from properties with status "em negociação")
      const vgv = 0;

      setStats({ leadsToday, hotLeads, followUps, vgv });

      // Build funnel
      const funnel = statuses.map(s => ({
        name: s.name,
        count: leads.filter(l => l.status_id === s.id).length,
        color: s.color,
      }));
      setFunnelData(funnel);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao carregar dados", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const displayInsights = insights.slice(0, 3);
  const barColors = ["hsl(207,45%,66%)", "hsl(207,45%,58%)", "hsl(207,45%,50%)", "hsl(207,45%,42%)", "hsl(207,45%,35%)"];

  return (
    <div className="space-y-6 pb-24">
      {/* Bento Grid */}
      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-2" : "grid-cols-4"
      )}>
        {/* Top 4 metric cards */}
        <BentoMetricCard
          title="Leads Hoje"
          value={stats.leadsToday}
          icon={Users}
          sparklineData={[1, 3, 2, 5, 4, 7, stats.leadsToday]}
        />
        <BentoMetricCard
          title="Leads Quentes"
          value={stats.hotLeads}
          icon={Flame}
          sparklineData={[2, 4, 3, 6, 5, 8, stats.hotLeads]}
        />
        <BentoMetricCard
          title="Follow-ups"
          value={stats.followUps}
          icon={Calendar}
          sparklineData={[0, 1, 2, 1, 3, 2, stats.followUps]}
        />
        <BentoMetricCard
          title="VGV Negociação"
          value={stats.vgv > 0 ? formatCurrency(stats.vgv) : "—"}
          icon={DollarSign}
          sparklineData={[0, 0, 1, 2, 1, 3, 2]}
        />
      </div>

      {/* Main row: AI Insights + Funnel */}
      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-1" : "grid-cols-2"
      )}>
        {/* AI Insights Panel */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-4 border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">AI Insights & Recomendações</h2>
          </div>
          <div className="flex-1 space-y-3">
            {displayInsights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma recomendação no momento. Tudo em dia! ✨</p>
            ) : (
              displayInsights.map((insight, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => insight.action?.path && navigate(insight.action.path)}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm text-accent leading-relaxed">{insight.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-4 border border-white/5 backdrop-blur-md">
          <h2 className="text-base font-semibold text-foreground">Funil de Conversão</h2>
          {funnelData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de funil ainda.</p>
          ) : (
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fill: "hsl(208,47%,77%)", fontSize: 12, style: { whiteSpace: 'nowrap' } }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                    {funnelData.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color || barColors[index % barColors.length]} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Priority Leads */}
      <div className="glass rounded-2xl p-6 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Leads Prioritários</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="gap-1 text-muted-foreground hover:text-foreground">
            Ver todos <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {priorityLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum lead prioritário no momento.</p>
        ) : (
          <div className="space-y-3">
            {priorityLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => navigate('/leads')}
              >
                <AvatarFallbackColored name={lead.name} size="md" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-foreground truncate">{lead.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {lead.temperature === 'hot' ? '🔥 Quente' : lead.temperature === 'warm' ? '🌡️ Morno' : '❄️ Frio'}
                    {' • '}{lead.daysSinceUpdate > 0 ? `${lead.daysSinceUpdate}d sem contato` : 'Recente'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <WhatsAppButton
                    phone={lead.phone}
                    leadName={lead.name}
                    leadId={lead.id}
                    className="h-9 w-9 p-0 rounded-full hover:shadow-glow transition-shadow"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:shadow-glow transition-shadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`tel:${lead.phone}`, '_self');
                    }}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
