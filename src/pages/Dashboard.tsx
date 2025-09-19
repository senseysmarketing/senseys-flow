import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp, 
  Plus, 
  FileDown,
  Calendar,
  Activity,
  Clock,
  AlertCircle,
  Phone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useOldLeads } from "@/hooks/use-old-leads";
import { useFollowUpReminders } from "@/hooks/use-follow-up-reminders";

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
  
  // Hook para leads antigos que precisam de follow-up
  const { oldLeads, loading: oldLeadsLoading, markLeadAsContacted } = useOldLeads(7);
  
  // Hook para lembretes automáticos de follow-up
  const { scheduleCustomReminder, highPriorityCount } = useFollowUpReminders();

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch leads with status information
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

      if (leadsError) {
        throw leadsError;
      }

      // Calculate stats
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

      // Set recent leads (last 10)
      const recentLeadsData = leads?.slice(0, 10).map(lead => ({
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

      // Fetch today's events
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

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      } else {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral dos seus leads e performance
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => navigate('/leads')} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
          <Button variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {stats.newLeads} novos nos últimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              Leads ativos no funil
            </p>
            {highPriorityCount > 0 && (
              <div className="mt-2">
                <Badge variant="destructive" className="text-xs">
                  {highPriorityCount} urgentes
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fechados</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.closed}</div>
            <p className="text-xs text-muted-foreground">
              Vendas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.lost} desistências
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais usadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/leads')}
            >
              <Plus className="h-6 w-6" />
              <span>Novo Lead</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/calendar')}
            >
              <Calendar className="h-6 w-6" />
              <span>Agendar</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/reports')}
            >
              <TrendingUp className="h-6 w-6" />
              <span>Relatórios</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/settings')}
            >
              <Users className="h-6 w-6" />
              <span>Configurações</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads Recentes</CardTitle>
          <CardDescription>
            Últimos leads cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lead cadastrado ainda</p>
              <Button 
                className="mt-4" 
                onClick={() => navigate('/leads')}
              >
                Cadastrar Primeiro Lead
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/leads`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{lead.name}</h4>
                      {lead.status_name && (
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: lead.status_color,
                            color: lead.status_color 
                          }}
                        >
                          {lead.status_name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lead.phone} • {lead.email && `${lead.email} • `}
                      {lead.origem && `${lead.origem} • `}
                      {formatDate(lead.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Alerts */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-orange-800 dark:text-orange-200">
              Leads Precisam de Follow-up
            </CardTitle>
          </div>
          <CardDescription className="text-orange-700/80 dark:text-orange-300/80">
            Leads que estão há mais de 7 dias como "Novo Lead"
          </CardDescription>
        </CardHeader>
        <CardContent>
          {oldLeadsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
            </div>
          ) : oldLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
              <p className="text-green-700 dark:text-green-300 font-medium">
                ✅ Todos os leads estão atualizados!
              </p>
              <p className="text-sm">Nenhum lead antigo precisa de follow-up</p>
            </div>
          ) : (
            <div className="space-y-3">
              {oldLeads.slice(0, 5).map((lead) => (
                <div 
                  key={lead.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-card border border-orange-200 dark:border-orange-800 rounded-lg hover:shadow-md transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{lead.name}</h4>
                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                        {lead.days_since_creation} dias
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lead.phone} • {lead.email && `${lead.email} • `}
                      {lead.origem && `${lead.origem} • `}
                      Criado em {new Date(lead.created_at).toLocaleDateString('pt-BR')}
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
                      Marcar Contatado
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
              
              {oldLeads.length > 5 && (
                <div className="text-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/leads')}
                    className="gap-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    Ver todos os {oldLeads.length} leads antigos
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Events */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos de Hoje</CardTitle>
          <CardDescription>
            Compromissos agendados para hoje
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum evento agendado para hoje</p>
              <Button 
                className="mt-4" 
                onClick={() => navigate('/calendar')}
              >
                Agendar Evento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {todayEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate('/calendar')}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">{event.title}</h4>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatTime(event.start_time)} - {formatTime(event.end_time)}
                      {event.location && ` • ${event.location}`}
                      {event.lead_name && ` • ${event.lead_name}`}
                    </div>
                    {event.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {event.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;