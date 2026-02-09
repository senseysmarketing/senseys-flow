import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Clock, 
  UserPlus, 
  ArrowRightLeft, 
  MessageSquare, 
  Phone, 
  Calendar, 
  FileText, 
  CheckCircle, 
  XCircle,
  Thermometer,
  Loader2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Activity {
  id: string;
  activity_type: string;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  created_by: string | null;
}

interface LeadActivityTimelineProps {
  leadId: string;
}

const activityConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  created: { icon: UserPlus, color: "text-green-500", label: "Lead criado" },
  status_changed: { icon: ArrowRightLeft, color: "text-blue-500", label: "Status alterado" },
  note_added: { icon: MessageSquare, color: "text-yellow-500", label: "Nota adicionada" },
  call_made: { icon: Phone, color: "text-purple-500", label: "Ligação realizada" },
  visit_scheduled: { icon: Calendar, color: "text-orange-500", label: "Visita agendada" },
  visit_completed: { icon: CheckCircle, color: "text-teal-500", label: "Visita realizada" },
  proposal_sent: { icon: FileText, color: "text-indigo-500", label: "Proposta enviada" },
  deal_won: { icon: CheckCircle, color: "text-green-600", label: "Negócio fechado" },
  deal_lost: { icon: XCircle, color: "text-red-500", label: "Negócio perdido" },
  temperature_changed: { icon: Thermometer, color: "text-amber-500", label: "Temperatura alterada" },
  disqualified: { icon: XCircle, color: "text-red-500", label: "Lead desqualificado" },
};

const LeadActivityTimeline = ({ leadId }: LeadActivityTimelineProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setActivities(data);
      }
      setLoading(false);
    };

    if (leadId) {
      fetchActivities();
    }
  }, [leadId]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getActivityConfig = (type: string) => {
    return activityConfig[type] || { icon: Clock, color: "text-muted-foreground", label: type };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[250px] pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />
        
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const config = getActivityConfig(activity.activity_type);
            const Icon = config.icon;
            const { date, time } = formatDateTime(activity.created_at);

            return (
              <div key={activity.id} className="relative flex gap-4 pl-1">
                {/* Timeline dot */}
                <div className={`relative z-10 flex items-center justify-center w-[30px] h-[30px] rounded-full bg-background border-2 border-border ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {config.label}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {activity.description}
                        </p>
                      )}
                      {activity.old_value && activity.new_value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="line-through opacity-70">{activity.old_value}</span>
                          <span className="mx-1">→</span>
                          <span className="font-medium text-foreground">{activity.new_value}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      <p>{date}</p>
                      <p>{time}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
};

export default LeadActivityTimeline;
