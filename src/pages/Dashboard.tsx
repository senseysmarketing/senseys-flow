import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  Plus, 
  FileDown,
  Calendar,
  Activity,
  Clock,
  AlertCircle,
  Phone,
  ChevronRight,
  Flame,
  Building2,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useOldLeads } from "@/hooks/use-old-leads";
import { useFollowUpReminders } from "@/hooks/use-follow-up-reminders";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  inProgress: number;
  closed: number;
  lost: number;
  conversionRate: number;
}

interface RecentLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  origem?: string;
  created_at: string;
  status_name?: string;
  status_color?: string;
}

interface TodayEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  lead_id?: string;
  lead_name?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    newLeads: 0,
    inProgress: 0,
    closed: 0,
    lost: 0,
    conversionRate: 0
  });
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { oldLeads, loading: oldLeadsLoading, markLeadAsContacted } = useOldLeads(7);
  const { highPriorityCount } = useFollowUpReminders();

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          phone,
          email,
          origem,
          created_at,
          lead_status (
            name,
            color
          )
        `)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      const totalLeads = leads?.length || 0;
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const newLeads = leads?.filter(lead => 
        new Date(lead.created_at) >= thirtyDaysAgo
      ).length || 0;

      const closed = leads?.filter(lead => 
        lead.lead_status?.name?.toLowerCase().includes('fechado')
      ).length || 0;

      const lost = leads?.filter(lead => 
        lead.lead_status?.name?.toLowerCase().includes('desistiu')
      ).length || 0;

      const inProgress = totalLeads - closed - lost;
      const conversionRate = totalLeads > 0 ? Math.round((closed / totalLeads) * 100) : 0;

      setStats({
        totalLeads,
        newLeads,
        inProgress,
        closed,
        lost,
        conversionRate
      });

      const recentLeadsData = leads?.slice(0, 5).map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        origem: lead.origem,
        created_at: lead.created_at,
        status_name: lead.lead_status?.name,
        status_color: lead.lead_status?.color
      })) || [];

      setRecentLeads(recentLeadsData);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          location,
          start_time,
          end_time,
          lead_id,
          leads (
            name
          )
        `)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (!eventsError) {
        const todayEventsData = events?.map(event => ({
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          start_time: event.start_time,
          end_time: event.end_time,
          lead_id: event.lead_id,
          lead_name: event.leads?.name
        })) || [];

        setTodayEvents(todayEventsData);
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "agora";
    if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)}min`;
    if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)}h`;
    return `há ${Math.floor(diffInSeconds / 86400)}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Bem-vindo de volta! 👋
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Aqui está um resumo do seu CRM hoje.
          </p>
        </div>
        
        <div className="flex gap-2 sm:gap-3">
          <Button onClick={() => navigate('/leads')} className="gap-2 flex-1 sm:flex-initial h-11 sm:h-10 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
            <Plus className="h-4 w-4" />
            <span className="sm:inline">Novo Lead</span>
          </Button>
          <Button variant="outline" className="gap-2 h-11 sm:h-10">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Leads"
          value={stats.totalLeads}
          subtitle={`${stats.newLeads} novos este mês`}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Em Atendimento"
          value={stats.inProgress}
          subtitle={highPriorityCount > 0 ? `${highPriorityCount} urgentes` : "Leads no funil"}
          icon={Activity}
          variant="warning"
        />
        <StatCard
          title="Fechados"
          value={stats.closed}
          subtitle="Vendas realizadas"
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Conversão"
          value={`${stats.conversionRate}%`}
          subtitle={`${stats.lost} desistências`}
          icon={TrendingUp}
          variant="default"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { icon: Plus, label: "Novo Lead", path: "/leads", color: "text-primary" },
          { icon: Calendar, label: "Agendar", path: "/calendar", color: "text-warning" },
          { icon: Building2, label: "Imóveis", path: "/properties", color: "text-success" },
          { icon: BarChart3, label: "Relatórios", path: "/reports", color: "text-accent" },
        ].map((action) => (
          <Button
            key={action.label}
            variant="outline"
            className="h-16 sm:h-20 flex-col gap-1 sm:gap-2 hover-lift group"
            onClick={() => navigate(action.path)}
          >
            <action.icon className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:scale-110", action.color)} />
            <span className="text-xs sm:text-sm">{action.label}</span>
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Leads Recentes
              </CardTitle>
              <CardDescription>Últimas adições ao sistema</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="gap-1">
              Ver todos
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum lead cadastrado ainda</p>
                <Button className="mt-4" onClick={() => navigate('/leads')}>
                  Cadastrar Primeiro Lead
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div 
                    key={lead.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/leads`)}
                  >
                    <AvatarFallbackColored name={lead.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{lead.name}</h4>
                        {lead.status_name && (
                          <Badge 
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{ 
                              borderColor: lead.status_color,
                              color: lead.status_color 
                            }}
                          >
                            {lead.status_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lead.origem || 'Origem não informada'} • {getRelativeTime(lead.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Events */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-warning" />
                Agenda de Hoje
              </CardTitle>
              <CardDescription>Seus compromissos do dia</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')} className="gap-1">
              Ver agenda
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {todayEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum evento hoje</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/calendar')}>
                  Agendar Evento
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayEvents.slice(0, 5).map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20"
                  >
                    <div className="flex-shrink-0 text-center">
                      <div className="text-lg font-bold text-warning">{formatTime(event.start_time)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{event.title}</h4>
                      {event.lead_name && (
                        <p className="text-xs text-muted-foreground">
                          Lead: {event.lead_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Follow-up Alerts */}
      {oldLeads.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle>Leads Precisam de Follow-up</CardTitle>
                <CardDescription>
                  {oldLeads.length} lead(s) há mais de 7 dias como "Novo Lead"
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {oldLeadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-warning/30 border-t-warning animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {oldLeads.slice(0, 3).map((lead) => (
                  <div 
                    key={lead.id}
                    className="flex items-center justify-between p-4 bg-card rounded-xl border"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarFallbackColored name={lead.name} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{lead.name}</h4>
                          <Badge variant="outline" className="text-warning border-warning/50">
                            {lead.days_since_creation} dias
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{lead.phone}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-2"
                        onClick={() => markLeadAsContacted(lead.id)}
                      >
                        <Phone className="h-4 w-4" />
                        Contatado
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => navigate('/leads')}
                      >
                        Ver Lead
                      </Button>
                    </div>
                  </div>
                ))}
                
                {oldLeads.length > 3 && (
                  <div className="text-center pt-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => navigate('/leads')}
                      className="gap-2 text-warning hover:text-warning"
                    >
                      <Flame className="h-4 w-4" />
                      Ver todos os {oldLeads.length} leads
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
