import { Users, Flame, Thermometer, Snowflake, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  temperature?: string | null;
  assigned_broker_id?: string | null;
}

interface LeadsMiniStatsProps {
  leads: Lead[];
  className?: string;
}

export const LeadsMiniStats = ({ leads, className }: LeadsMiniStatsProps) => {
  const total = leads.length;
  const hot = leads.filter((l) => l.temperature === "hot").length;
  const warm = leads.filter((l) => l.temperature === "warm").length;
  const cold = leads.filter((l) => l.temperature === "cold").length;
  const unassigned = leads.filter((l) => !l.assigned_broker_id).length;

  const stats = [
    { 
      label: "Total", 
      value: total, 
      icon: Users, 
      color: "text-primary",
      bgColor: "bg-primary/10" 
    },
    { 
      label: "Quentes", 
      value: hot, 
      icon: Flame, 
      color: "text-orange-500",
      bgColor: "bg-orange-500/10" 
    },
    { 
      label: "Mornos", 
      value: warm, 
      icon: Thermometer, 
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10" 
    },
    { 
      label: "Frios", 
      value: cold, 
      icon: Snowflake, 
      color: "text-blue-400",
      bgColor: "bg-blue-400/10" 
    },
    { 
      label: "Sem Corretor", 
      value: unassigned, 
      icon: UserX, 
      color: "text-muted-foreground",
      bgColor: "bg-muted" 
    },
  ];

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1", className)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap",
              stat.bgColor
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", stat.color)} />
            <span className="font-medium">{stat.value}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {stat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
