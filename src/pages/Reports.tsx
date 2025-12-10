import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, TrendingDown, Users, Calendar, Target, DollarSign, Flame, Trophy, Building2, Megaphone, Thermometer, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import BrokerRanking from "@/components/BrokerRanking";
import AdInsightsTab, { AdStats } from "@/components/reports/AdInsightsTab";
import PropertyInsightsTab, { PropertyStats } from "@/components/reports/PropertyInsightsTab";

interface LeadStats {
  total: number;
  thisMonth: number;
  lastMonth: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  closedLeads: number;
  byStatus: { name: string; count: number; color: string }[];
  bySource: { name: string; count: number }[];
  byInterest: { name: string; count: number }[];
  byTemperature: { name: string; count: number; color: string }[];
  byCampaign: { name: string; count: number }[];
  dailyCreated: { date: string; count: number }[];
}

interface EventStats {
  total: number;
  thisMonth: number;
  completed: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];
const TEMPERATURE_COLORS = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#3b82f6',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const ReportsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leadStats, setLeadStats] = useState<LeadStats>({
    total: 0,
    thisMonth: 0,
    lastMonth: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    closedLeads: 0,
    byStatus: [],
    bySource: [],
    byInterest: [],
    byTemperature: [],
    byCampaign: [],
    dailyCreated: []
  });
  const [eventStats, setEventStats] = useState<EventStats>({
    total: 0,
    thisMonth: 0,
    completed: 0
  });
  const [adStats, setAdStats] = useState<AdStats>({
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalLeads: 0,
    totalReach: 0,
    avgCPM: 0,
    avgCPC: 0,
    avgCPL: 0,
    avgCTR: 0,
    dailyData: [],
    campaignData: [],
    config: null
  });
  const [propertyStats, setPropertyStats] = useState<PropertyStats[]>([]);
  const [period, setPeriod] = useState("30");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Calculate date range based on period or custom dates
  const getDateRange = () => {
    if (period === "custom" && customDateFrom && customDateTo) {
      return { from: customDateFrom, to: customDateTo };
    }
    const now = new Date();
    const days = period === "custom" ? 30 : parseInt(period);
    const from = format(subDays(now, days), "yyyy-MM-dd");
    const to = format(now, "yyyy-MM-dd");
    return { from, to };
  };

  const handlePeriodChange = (value: string) => {
    if (value === "custom") {
      setShowCustomDatePicker(true);
    } else {
      setPeriod(value);
      setShowCustomDatePicker(false);
    }
  };

  const handleApplyCustomPeriod = () => {
    if (!customDateFrom || !customDateTo) {
      toast({
        variant: "destructive",
        title: "Datas inválidas",
        description: "Selecione as datas de início e fim.",
      });
      return;
    }

    const from = parseISO(customDateFrom);
    const to = parseISO(customDateTo);
    const daysDiff = differenceInDays(to, from);

    if (daysDiff < 0) {
      toast({
        variant: "destructive",
        title: "Datas inválidas",
        description: "A data de início deve ser anterior à data de fim.",
      });
      return;
    }

    if (daysDiff > 90) {
      toast({
        variant: "destructive",
        title: "Período muito longo",
        description: "O período máximo permitido é de 90 dias.",
      });
      return;
    }

    setPeriod("custom");
    setShowCustomDatePicker(false);
  };

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, period, customDateFrom, customDateTo]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchLeadStats(),
        fetchEventStats(),
        fetchAdStats(),
        fetchPropertyStats()
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
    const startDate = subDays(now, parseInt(period));
    const startOfThisMonth = startOfMonth(now);
    const endOfThisMonth = endOfMonth(now);
    const startOfLastMonth = startOfMonth(subDays(startOfThisMonth, 1));
    const endOfLastMonth = endOfMonth(subDays(startOfThisMonth, 1));

    // Total de leads
    const { data: totalLeads, error: totalError } = await supabase
      .from("leads")
      .select("id, temperature, meta_campaign_name", { count: "exact" });

    if (totalError) throw totalError;

    // Contar por temperatura
    const hotLeads = totalLeads?.filter(l => l.temperature === 'hot').length || 0;
    const warmLeads = totalLeads?.filter(l => l.temperature === 'warm').length || 0;
    const coldLeads = totalLeads?.filter(l => l.temperature === 'cold').length || 0;

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

    const closedLeads = statusCounts.find(s => s.name === 'Fechado')?.count || 0;

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

    // Leads por campanha Meta
    const campaignCounts = totalLeads?.reduce((acc, lead) => {
      if (!lead.meta_campaign_name) return acc;
      const existing = acc.find(item => item.name === lead.meta_campaign_name);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ name: lead.meta_campaign_name, count: 1 });
      }
      return acc;
    }, [] as { name: string; count: number }[]) || [];

    // Temperatura data
    const temperatureData = [
      { name: 'Quentes', count: hotLeads, color: TEMPERATURE_COLORS.hot },
      { name: 'Mornos', count: warmLeads, color: TEMPERATURE_COLORS.warm },
      { name: 'Frios', count: coldLeads, color: TEMPERATURE_COLORS.cold },
    ].filter(d => d.count > 0);

    // Leads criados por dia
    const daysInterval = eachDayOfInterval({
      start: startDate,
      end: now
    });

    const { data: dailyLeads, error: dailyError } = await supabase
      .from("leads")
      .select("created_at")
      .gte("created_at", startDate.toISOString());

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
      hotLeads,
      warmLeads,
      coldLeads,
      closedLeads,
      byStatus: statusCounts,
      bySource: sourceCounts,
      byInterest: interestCounts,
      byTemperature: temperatureData,
      byCampaign: campaignCounts.sort((a, b) => b.count - a.count),
      dailyCreated
    });
  };

  const fetchEventStats = async () => {
    const now = new Date();
    const startOfThisMonth = startOfMonth(now);
    const endOfThisMonth = endOfMonth(now);

    const { data: totalEvents, error: totalError } = await supabase
      .from("events")
      .select("id", { count: "exact" });

    if (totalError) throw totalError;

    const { data: thisMonthEvents, error: thisMonthError } = await supabase
      .from("events")
      .select("id", { count: "exact" })
      .gte("start_time", startOfThisMonth.toISOString())
      .lte("start_time", endOfThisMonth.toISOString());

    if (thisMonthError) throw thisMonthError;

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

  const fetchAdStats = async () => {
    const now = new Date();
    const startDate = subDays(now, parseInt(period));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No session for ad stats");
        return;
      }

      const response = await supabase.functions.invoke('meta-insights', {
        body: { 
          action: 'get',
          date_from: format(startDate, "yyyy-MM-dd"),
          date_to: format(now, "yyyy-MM-dd")
        },
      });

      if (response.error) {
        console.error("Erro ao buscar insights:", response.error);
        return;
      }

      const data = response.data;

      if (data.error) {
        // Not configured - set empty state with null config
        setAdStats({
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalLeads: 0,
          totalReach: 0,
          avgCPM: 0,
          avgCPC: 0,
          avgCPL: 0,
          avgCTR: 0,
          dailyData: [],
          campaignData: [],
          config: null
        });
        return;
      }

      const { insights, totals, campaignData, config } = data;

      // Dados diários
      const dailyData = (insights || []).map((day: any) => ({
        date: format(new Date(day.date), "dd/MM", { locale: ptBR }),
        spend: day.spend || 0,
        leads: day.leads_count || 0,
        clicks: day.clicks || 0,
      }));

      setAdStats({
        totalSpend: totals?.spend || 0,
        totalImpressions: totals?.impressions || 0,
        totalClicks: totals?.clicks || 0,
        totalLeads: totals?.leads_count || 0,
        totalReach: totals?.reach || 0,
        avgCPM: totals?.cpm || 0,
        avgCPC: totals?.cpc || 0,
        avgCPL: totals?.cpl || 0,
        avgCTR: totals?.ctr || 0,
        dailyData,
        campaignData: campaignData || [],
        config: config || null
      });
    } catch (error) {
      console.error("Erro ao buscar insights de anúncios:", error);
    }
  };

  const fetchPropertyStats = async () => {
    // Buscar todas as propriedades
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, title, type, status, campaign_cost");

    if (propError) {
      console.error("Erro ao buscar propriedades:", propError);
      return;
    }

    if (!properties || properties.length === 0) {
      setPropertyStats([]);
      return;
    }

    // Buscar leads vinculados a propriedades
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("property_id, temperature")
      .not("property_id", "is", null);

    if (leadsError) {
      console.error("Erro ao buscar leads de propriedades:", leadsError);
      return;
    }

    // Agregar leads por propriedade
    const stats: PropertyStats[] = properties.map(prop => {
      const propLeads = leads?.filter(l => l.property_id === prop.id) || [];
      const leadCount = propLeads.length;
      const hotLeads = propLeads.filter(l => l.temperature === 'hot').length;
      const warmLeads = propLeads.filter(l => l.temperature === 'warm').length;
      const coldLeads = propLeads.filter(l => l.temperature === 'cold').length;
      const campaignCost = prop.campaign_cost || 0;
      const cpl = leadCount > 0 ? campaignCost / leadCount : 0;

      return {
        id: prop.id,
        title: prop.title,
        type: prop.type,
        status: prop.status || 'disponivel',
        leadCount,
        hotLeads,
        warmLeads,
        coldLeads,
        campaignCost,
        cpl
      };
    });

    setPropertyStats(stats);
  };

  const growthRate = leadStats.lastMonth > 0 
    ? ((leadStats.thisMonth - leadStats.lastMonth) / leadStats.lastMonth * 100)
    : leadStats.thisMonth > 0 ? 100 : 0;

  const conversionRate = leadStats.total > 0 
    ? (leadStats.closedLeads / leadStats.total * 100)
    : 0;

  const totalInvestment = adStats.totalSpend + propertyStats.reduce((acc, p) => acc + p.campaignCost, 0);
  const avgCPL = leadStats.total > 0 ? totalInvestment / leadStats.total : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { from: dateFrom, to: dateTo } = getDateRange();
  const periodLabel = period === "custom" 
    ? `${format(parseISO(customDateFrom), "dd/MM")} - ${format(parseISO(customDateTo), "dd/MM")}`
    : `Últimos ${period} dias`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Análise completa de performance e métricas</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={period === "custom" ? "custom" : period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-48">
              <SelectValue>
                {period === "custom" ? periodLabel : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="custom">Personalizado...</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
            <PopoverTrigger asChild>
              <span></span>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Período Personalizado</h4>
                  <p className="text-sm text-muted-foreground">
                    Máximo de 90 dias
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="global-date-from">Data Início</Label>
                    <Input
                      id="global-date-from"
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      max={format(new Date(), "yyyy-MM-dd")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="global-date-to">Data Fim</Label>
                    <Input
                      id="global-date-to"
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      max={format(new Date(), "yyyy-MM-dd")}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleApplyCustomPeriod}
                  disabled={!customDateFrom || !customDateTo}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Aplicar Período
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPIs Globais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvestment)}</div>
            <p className="text-xs text-muted-foreground">
              Meta Ads + Campanhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadStats.total}</div>
            <div className="flex items-center gap-1 text-xs">
              {growthRate >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Quentes</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadStats.hotLeads}</div>
            <p className="text-xs text-muted-foreground">
              {leadStats.total > 0 ? ((leadStats.hotLeads / leadStats.total) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgCPL)}</div>
            <p className="text-xs text-muted-foreground">
              custo por lead
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {leadStats.closedLeads} leads fechados
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="leads">
            <Target className="h-4 w-4 mr-2" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="ads">
            <Megaphone className="h-4 w-4 mr-2" />
            Anúncios
          </TabsTrigger>
          <TabsTrigger value="properties">
            <Building2 className="h-4 w-4 mr-2" />
            Imóveis
          </TabsTrigger>
          <TabsTrigger value="brokers">
            <Trophy className="h-4 w-4 mr-2" />
            Corretores
          </TabsTrigger>
          <TabsTrigger value="events">
            <Calendar className="h-4 w-4 mr-2" />
            Eventos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Leads por Status</CardTitle>
                <CardDescription>Distribuição dos leads por status atual</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={leadStats.byStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ name, value }) => `${value}`}
                    >
                      {leadStats.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                  {leadStats.byStatus.map((status) => (
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
                <CardTitle>Leads por Temperatura</CardTitle>
                <CardDescription>Classificação de qualidade dos leads</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={leadStats.byTemperature}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {leadStats.byTemperature.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{leadStats.hotLeads}</p>
                      <p className="text-xs text-muted-foreground">Quentes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{leadStats.warmLeads}</p>
                      <p className="text-xs text-muted-foreground">Mornos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{leadStats.coldLeads}</p>
                      <p className="text-xs text-muted-foreground">Frios</p>
                    </div>
                  </div>
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
                  <BarChart data={leadStats.bySource.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis 
                      dataKey="name" 
                      type="category"
                      width={100}
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Leads por Campanha Meta */}
          {leadStats.byCampaign.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Leads por Campanha Meta</CardTitle>
                <CardDescription>Distribuição de leads por campanha de anúncios</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={leadStats.byCampaign.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      className="text-xs"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads">
          <AdInsightsTab adStats={adStats} dateFrom={dateFrom} dateTo={dateTo} onRefresh={fetchAdStats} />
        </TabsContent>

        <TabsContent value="properties">
          <PropertyInsightsTab propertyStats={propertyStats} period={period} />
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
