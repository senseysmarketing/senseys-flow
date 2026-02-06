import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import { 
  Plus, 
  Calendar,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Dashboard Components
import { DailyStats } from "@/components/dashboard/DailyStats";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { QuickLeadActions } from "@/components/dashboard/QuickLeadActions";
import { MiniConversionFunnel } from "@/components/dashboard/MiniConversionFunnel";
import { PropertyHighlights } from "@/components/dashboard/PropertyHighlights";
import BrokerRanking from "@/components/BrokerRanking";

interface RecentLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  origem?: string;
  created_at: string;
  status_name?: string;
  status_color?: string;
  temperature?: string;
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
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch recent leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          phone,
          email,
          origem,
          temperature,
          created_at,
          lead_status (
            name,
            color
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (leadsError) throw leadsError;

      const recentLeadsData = leads?.map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        origem: lead.origem,
        temperature: lead.temperature,
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

  const getTemperatureColor = (temp?: string) => {
    switch (temp) {
      case 'hot': return 'bg-gradient-to-r from-orange-500 to-red-500';
      case 'warm': return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      case 'cold': return 'bg-gradient-to-r from-blue-400 to-cyan-500';
      default: return 'bg-muted';
    }
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
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Visão geral do seu CRM em tempo real
          </p>
        </div>
        
        <div className="flex gap-2 sm:gap-3">
          <Button 
            onClick={() => navigate('/leads')} 
            className="gap-2 flex-1 sm:flex-initial h-11 sm:h-10 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Lead</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/calendar')}
            className="gap-2 h-11 sm:h-10"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </Button>
        </div>
      </div>

      {/* Daily Stats - Hero KPIs */}
      <DailyStats />

      {/* Insights Panel - AI Recommendations */}
      <InsightsPanel maxItems={4} />

      {/* Main Grid - Priority Leads + Funnel */}
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickLeadActions maxItems={5} />
        <MiniConversionFunnel />
      </div>

      {/* Secondary Grid - Recent Leads + Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
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
                    onClick={() => navigate('/leads')}
                  >
                    <AvatarFallbackColored name={lead.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{lead.name}</h4>
                        {lead.temperature && (
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            getTemperatureColor(lead.temperature)
                          )} />
                        )}
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
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
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

      {/* Bottom Grid - Ranking + Properties */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BrokerRanking />
        <PropertyHighlights maxItems={4} />
      </div>
    </div>
  );
};

export default Dashboard;
