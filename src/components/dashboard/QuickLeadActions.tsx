import { useLeadPriorities, PriorityLead } from "@/hooks/use-lead-priorities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import TemperatureBadge from "@/components/TemperatureBadge";
import WhatsAppButton from "@/components/WhatsAppButton";
import { 
  Clock, 
  Phone, 
  ChevronRight,
  Flame,
  CheckCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const urgencyStyles = {
  critical: {
    badge: "bg-destructive text-destructive-foreground",
    bg: "bg-destructive/10",
  },
  high: {
    badge: "bg-warning text-warning-foreground",
    bg: "bg-warning/10",
  },
  medium: {
    badge: "bg-primary text-primary-foreground",
    bg: "bg-primary/10",
  },
  low: {
    badge: "bg-muted text-muted-foreground",
    bg: "bg-muted/10",
  },
};

interface QuickLeadActionsProps {
  maxItems?: number;
  className?: string;
}

export const QuickLeadActions = ({
  maxItems = 5,
  className,
}: QuickLeadActionsProps) => {
  const { priorityLeads, loading, stats, markAsContacted } = useLeadPriorities(maxItems);
  const navigate = useNavigate();

  const handleMarkContacted = async (e: React.MouseEvent, lead: PriorityLead) => {
    e.stopPropagation();
    try {
      await markAsContacted(lead.id);
      toast({
        title: "Lead atualizado",
        description: `${lead.name} marcado como contatado.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o lead.",
      });
    }
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-32 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (priorityLeads.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-warning" />
            Leads Prioritários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-4 text-success opacity-50" />
            <p className="text-sm font-medium">Todos os leads em dia!</p>
            <p className="text-xs mt-1">Nenhum lead precisa de atenção imediata.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-warning" />
              Leads Prioritários
            </CardTitle>
            <CardDescription>
              {stats.critical > 0 && (
                <span className="text-destructive font-medium">
                  {stats.critical} crítico{stats.critical > 1 ? 's' : ''}
                </span>
              )}
              {stats.critical > 0 && stats.high > 0 && " • "}
              {stats.high > 0 && (
                <span className="text-warning font-medium">
                  {stats.high} urgente{stats.high > 1 ? 's' : ''}
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/leads")}
            className="gap-1"
          >
            Ver todos
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 p-4 pt-0">
            {priorityLeads.map((lead) => (
              <div
                key={lead.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer hover:shadow-md",
                  urgencyStyles[lead.urgency].bg
                )}
                onClick={() => navigate("/leads")}
              >
                <AvatarFallbackColored name={lead.name} size="sm" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{lead.name}</h4>
                    <TemperatureBadge temperature={lead.temperature} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {lead.daysSinceUpdate === 0 
                        ? "Hoje" 
                        : `${lead.daysSinceUpdate} dia${lead.daysSinceUpdate > 1 ? 's' : ''} sem contato`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <WhatsAppButton phone={lead.phone} leadName={lead.name} size="sm" variant="icon" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => handleMarkContacted(e, lead)}
                    title="Marcar como contatado"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
