import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Trophy, TrendingUp, Users, Target, Clock, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInHours } from "date-fns";

interface BrokerStats {
  user_id: string;
  full_name: string | null;
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  closed_leads: number;
  conversion_rate: number;
  avg_response_time: number | null;
}

const BrokerRanking = () => {
  const [loading, setLoading] = useState(true);
  const [brokerStats, setBrokerStats] = useState<BrokerStats[]>([]);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchBrokerStats();
  }, [period]);

  const fetchBrokerStats = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(period)).toISOString();

      // Get all brokers
      const { data: brokers, error: brokersError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (brokersError) throw brokersError;

      // Get leads with broker assignment
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select(`
          id,
          assigned_broker_id,
          temperature,
          status_id,
          created_at,
          lead_status(name)
        `)
        .gte("created_at", startDate);

      if (leadsError) throw leadsError;

      // Get activities for response time calculation
      const { data: activities, error: activitiesError } = await supabase
        .from("lead_activities")
        .select("lead_id, created_at, activity_type, created_by")
        .in("activity_type", ["status_changed", "note_added", "temperature_changed"])
        .gte("created_at", startDate);

      if (activitiesError) throw activitiesError;

      // Calculate stats per broker
      const stats: BrokerStats[] = brokers.map(broker => {
        const brokerLeads = leads.filter(l => l.assigned_broker_id === broker.user_id);
        const totalLeads = brokerLeads.length;
        const hotLeads = brokerLeads.filter(l => l.temperature === "hot").length;
        const warmLeads = brokerLeads.filter(l => l.temperature === "warm").length;
        const coldLeads = brokerLeads.filter(l => l.temperature === "cold").length;
        const closedLeads = brokerLeads.filter(l => l.lead_status?.name === "Fechado").length;
        
        // Calculate average response time (first activity after lead creation)
        const responseTimes: number[] = [];
        brokerLeads.forEach(lead => {
          const leadActivities = activities
            .filter(a => a.lead_id === lead.id && a.created_by === broker.user_id && a.created_by !== null)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          if (leadActivities.length > 0) {
            const leadCreated = new Date(lead.created_at);
            const firstActivity = new Date(leadActivities[0].created_at);
            const hours = differenceInHours(firstActivity, leadCreated);
            if (hours >= 0 && hours < 168) { // Less than a week
              responseTimes.push(hours);
            }
          }
        });

        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : null;

        return {
          user_id: broker.user_id,
          full_name: broker.full_name,
          total_leads: totalLeads,
          hot_leads: hotLeads,
          warm_leads: warmLeads,
          cold_leads: coldLeads,
          closed_leads: closedLeads,
          conversion_rate: totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0,
          avg_response_time: avgResponseTime,
        };
      });

      // Sort by total leads (descending)
      stats.sort((a, b) => b.total_leads - a.total_leads);
      setBrokerStats(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center font-medium text-muted-foreground">{index + 1}</span>;
  };

  const chartData = brokerStats
    .filter(b => b.total_leads > 0)
    .slice(0, 10)
    .map(b => ({
      name: b.full_name?.split(" ")[0] || "?",
      leads: b.total_leads,
      fechados: b.closed_leads,
    }));

  const COLORS = ["#81afd1", "#a6c8e1", "#465666", "#5a5f65", "#2b2d2c"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ranking de Corretores</h3>
          <p className="text-sm text-muted-foreground">Performance da equipe no período selecionado</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {brokerStats.reduce((acc, b) => acc + b.total_leads, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              distribuídos entre {brokerStats.filter(b => b.total_leads > 0).length} corretores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Quentes</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {brokerStats.reduce((acc, b) => acc + b.hot_leads, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              prontos para fechar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const total = brokerStats.reduce((acc, b) => acc + b.total_leads, 0);
                const closed = brokerStats.reduce((acc, b) => acc + b.closed_leads, 0);
                return total > 0 ? ((closed / total) * 100).toFixed(1) : 0;
              })()}%
            </div>
            <p className="text-xs text-muted-foreground">
              média geral
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const times = brokerStats.filter(b => b.avg_response_time !== null).map(b => b.avg_response_time!);
                if (times.length === 0) return "-";
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                return `${avg.toFixed(0)}h`;
              })()}
            </div>
            <p className="text-xs text-muted-foreground">
              média até primeira interação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leads por Corretor</CardTitle>
            <CardDescription>Comparativo de leads e fechamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="hsl(var(--primary))" name="Total Leads" />
                <Bar dataKey="fechados" fill="hsl(var(--secondary))" name="Fechados" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking Detalhado</CardTitle>
          <CardDescription>Performance individual de cada corretor</CardDescription>
        </CardHeader>
        <CardContent>
          {brokerStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum corretor encontrado
            </p>
          ) : (
            <div className="space-y-4">
              {brokerStats.map((broker, index) => (
                <div
                  key={broker.user_id}
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    index < 3 ? "bg-muted/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[180px]">
                    {getRankBadge(index)}
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(broker.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate">
                      {broker.full_name || "Sem nome"}
                    </span>
                  </div>

                  <div className="flex-1 grid grid-cols-6 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="font-semibold">{broker.total_leads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quentes</p>
                      <p className="font-semibold text-red-500">{broker.hot_leads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mornos</p>
                      <p className="font-semibold text-yellow-500">{broker.warm_leads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Frios</p>
                      <p className="font-semibold text-blue-500">{broker.cold_leads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fechados</p>
                      <p className="font-semibold text-green-500">{broker.closed_leads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conversão</p>
                      <p className="font-semibold">{broker.conversion_rate.toFixed(1)}%</p>
                    </div>
                  </div>

                  {broker.avg_response_time !== null && (
                    <Badge variant="outline" className="shrink-0">
                      <Clock className="h-3 w-3 mr-1" />
                      {broker.avg_response_time.toFixed(0)}h
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrokerRanking;
