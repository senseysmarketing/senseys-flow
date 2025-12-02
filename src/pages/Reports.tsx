import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, Users, Calendar, Target, Phone, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import BrokerRanking from "@/components/BrokerRanking";

interface LeadStats {
  total: number;
  thisMonth: number;
  lastMonth: number;
  byStatus: { name: string; count: number; color: string }[];
  bySource: { name: string; count: number }[];
  byInterest: { name: string; count: number }[];
  dailyCreated: { date: string; count: number }[];
}

interface EventStats {
  total: number;
  thisMonth: number;
  completed: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

const ReportsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leadStats, setLeadStats] = useState<LeadStats>({
    total: 0,
    thisMonth: 0,
    lastMonth: 0,
    byStatus: [],
    bySource: [],
    byInterest: [],
    dailyCreated: []
  });
  const [eventStats, setEventStats] = useState<EventStats>({
    total: 0,
    thisMonth: 0,
    completed: 0
  });
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, period]);

  const fetchStats = async () => {
    try {
      await Promise.all([
        fetchLeadStats(),
        fetchEventStats()
      ]);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os relatórios.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadStats = async () => {
    const now = new Date();
    const startOfThisMonth = startOfMonth(now);
    const endOfThisMonth = endOfMonth(now);
    const startOfLastMonth = startOfMonth(subDays(startOfThisMonth, 1));
    const endOfLastMonth = endOfMonth(subDays(startOfThisMonth, 1));

    // Total de leads
    const { data: totalLeads, error: totalError } = await supabase
      .from("leads")
      .select("id", { count: "exact" });

    if (totalError) throw totalError;

    // Leads este mês
    const { data: thisMonthLeads, error: thisMonthError } = await supabase
      .from("leads")
      .select("id", { count: "exact" })
      .gte("created_at", startOfThisMonth.toISOString())
      .lte("created_at", endOfThisMonth.toISOString());

    if (thisMonthError) throw thisMonthError;

    // Leads mês passado
    const { data: lastMonthLeads, error: lastMonthError } = await supabase
      .from("leads")
      .select("id", { count: "exact" })
      .gte("created_at", startOfLastMonth.toISOString())
      .lte("created_at", endOfLastMonth.toISOString());

    if (lastMonthError) throw lastMonthError;

    // Leads por status
    const { data: leadsByStatus, error: statusError } = await supabase
      .from("leads")
      .select(`
        status_id,
        lead_status!inner(name, color)
      `);

    if (statusError) throw statusError;

    const statusCounts = leadsByStatus?.reduce((acc, lead) => {
      const statusName = lead.lead_status?.name || "Sem Status";
      const statusColor = lead.lead_status?.color || "#5a5f65";
      const existing = acc.find(item => item.name === statusName);
      
      if (existing) {
        existing.count++;
      } else {
        acc.push({ name: statusName, count: 1, color: statusColor });
      }
      
      return acc;
    }, [] as { name: string; count: number; color: string }[]) || [];

    // Leads por origem
    const { data: leadsBySource, error: sourceError } = await supabase
      .from("leads")
      .select("origem");

    if (sourceError) throw sourceError;

    const sourceCounts = leadsBySource?.reduce((acc, lead) => {
      const source = lead.origem || "Não informado";
      const existing = acc.find(item => item.name === source);
      
      if (existing) {
        existing.count++;
      } else {
        acc.push({ name: source, count: 1 });
      }
      
      return acc;
    }, [] as { name: string; count: number }[]) || [];

    // Leads por interesse
    const { data: leadsByInterest, error: interestError } = await supabase
      .from("leads")
      .select("interesse");

    if (interestError) throw interestError;

    const interestCounts = leadsByInterest?.reduce((acc, lead) => {
      const interest = lead.interesse || "Não informado";
      const existing = acc.find(item => item.name === interest);
      
      if (existing) {
        existing.count++;
      } else {
        acc.push({ name: interest, count: 1 });
      }
      
      return acc;
    }, [] as { name: string; count: number }[]) || [];

    // Leads criados por dia (últimos 30 dias)
    const daysInterval = eachDayOfInterval({
      start: subDays(now, parseInt(period)),
      end: now
    });

    const { data: dailyLeads, error: dailyError } = await supabase
      .from("leads")
      .select("created_at")
      .gte("created_at", subDays(now, parseInt(period)).toISOString());

    if (dailyError) throw dailyError;

    const dailyCreated = daysInterval.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = dailyLeads?.filter(lead => 
        format(new Date(lead.created_at), "yyyy-MM-dd") === dayStr
      ).length || 0;
      
      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        count
      };
    });

    setLeadStats({
      total: totalLeads?.length || 0,
      thisMonth: thisMonthLeads?.length || 0,
      lastMonth: lastMonthLeads?.length || 0,
      byStatus: statusCounts,
      bySource: sourceCounts,
      byInterest: interestCounts,
      dailyCreated
    });
  };

  const fetchEventStats = async () => {
    const now = new Date();
    const startOfThisMonth = startOfMonth(now);
    const endOfThisMonth = endOfMonth(now);

    // Total de eventos
    const { data: totalEvents, error: totalError } = await supabase
      .from("events")
      .select("id", { count: "exact" });

    if (totalError) throw totalError;

    // Eventos este mês
    const { data: thisMonthEvents, error: thisMonthError } = await supabase
      .from("events")
      .select("id", { count: "exact" })
      .gte("start_time", startOfThisMonth.toISOString())
      .lte("start_time", endOfThisMonth.toISOString());

    if (thisMonthError) throw thisMonthError;

    // Eventos concluídos (já passaram)
    const { data: completedEvents, error: completedError } = await supabase
      .from("events")
      .select("id", { count: "exact" })
      .lt("end_time", now.toISOString());

    if (completedError) throw completedError;

    setEventStats({
      total: totalEvents?.length || 0,
      thisMonth: thisMonthEvents?.length || 0,
      completed: completedEvents?.length || 0
    });
  };

  const growthRate = leadStats.lastMonth > 0 
    ? ((leadStats.thisMonth - leadStats.lastMonth) / leadStats.lastMonth * 100)
    : leadStats.thisMonth > 0 ? 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Análise de performance e métricas</p>
        </div>
        
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadStats.total}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{leadStats.thisMonth} este mês</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
            {growthRate >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              vs. mês anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {eventStats.completed} concluídos
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
              {leadStats.total > 0 
                ? ((leadStats.byStatus.find(s => s.name === 'Fechado')?.count || 0) / leadStats.total * 100).toFixed(1)
                : 0
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              leads fechados
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="brokers">
            <Trophy className="h-4 w-4 mr-2" />
            Corretores
          </TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Leads por Status</CardTitle>
                <CardDescription>Distribuição dos leads por status atual</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadStats.byStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {leadStats.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="mt-4 space-y-2">
                  {leadStats.byStatus.map((status, index) => (
                    <div key={status.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm">{status.name}</span>
                      </div>
                      <Badge variant="outline">{status.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leads por Origem</CardTitle>
                <CardDescription>Principais fontes de captação</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadStats.bySource}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leads por Interesse</CardTitle>
                <CardDescription>Distribuição por área de interesse</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadStats.byInterest}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {leadStats.byInterest.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="mt-4 space-y-2">
                  {leadStats.byInterest.map((interest, index) => (
                    <div key={interest.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm">{interest.name}</span>
                      </div>
                      <Badge variant="outline">{interest.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolução de Leads</CardTitle>
              <CardDescription>
                Leads criados nos últimos {period} dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={leadStats.dailyCreated}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total de Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{eventStats.total}</div>
                <p className="text-muted-foreground">eventos criados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Este Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{eventStats.thisMonth}</div>
                <p className="text-muted-foreground">eventos em {format(new Date(), "MMMM", { locale: ptBR })}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Concluídos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{eventStats.completed}</div>
                <p className="text-muted-foreground">eventos realizados</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Análise de Eventos</CardTitle>
              <CardDescription>Estatísticas detalhadas dos eventos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Taxa de Realização</p>
                    <p className="text-sm text-muted-foreground">
                      Eventos concluídos vs total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {eventStats.total > 0 
                        ? ((eventStats.completed / eventStats.total) * 100).toFixed(1)
                        : 0
                      }%
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Eventos Pendentes</p>
                    <p className="text-sm text-muted-foreground">
                      Eventos futuros agendados
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {eventStats.total - eventStats.completed}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brokers">
          <BrokerRanking />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;