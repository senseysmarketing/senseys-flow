import { useState } from "react";
import { Users, Flame, Thermometer, Snowflake, UserX, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  temperature?: string | null;
  assigned_broker_id?: string | null;
  created_at: string;
}

interface LeadsHeroStatsProps {
  leads: Lead[];
  className?: string;
  onFilterChange?: (filter: { type: string; value: string | null }) => void;
}

export const LeadsHeroStats = ({ leads, className, onFilterChange }: LeadsHeroStatsProps) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Calculate stats
  const total = leads.length;
  const hot = leads.filter((l) => l.temperature === "hot").length;
  const warm = leads.filter((l) => l.temperature === "warm").length;
  const cold = leads.filter((l) => l.temperature === "cold").length;
  const unassigned = leads.filter((l) => !l.assigned_broker_id).length;

  // Calculate today's leads
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLeads = leads.filter((l) => new Date(l.created_at) >= today);
  const todayHot = todayLeads.filter((l) => l.temperature === "hot").length;
  const todayWarm = todayLeads.filter((l) => l.temperature === "warm").length;
  const todayCold = todayLeads.filter((l) => l.temperature === "cold").length;
  const todayTotal = todayLeads.length;

  const handleClick = (filterKey: string, filterValue: string | null) => {
    if (activeFilter === filterKey) {
      setActiveFilter(null);
      onFilterChange?.({ type: "clear", value: null });
    } else {
      setActiveFilter(filterKey);
      onFilterChange?.({ type: filterKey, value: filterValue });
    }
  };

  const stats = [
    {
      key: "total",
      label: "Total",
      value: total,
      trend: todayTotal,
      icon: Users,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      ringColor: "ring-primary/50",
      filterValue: null,
    },
    {
      key: "hot",
      label: "Quentes",
      value: hot,
      trend: todayHot,
      icon: Flame,
      gradient: "from-orange-500/20 to-orange-500/5",
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-500",
      ringColor: "ring-orange-500/50",
      filterValue: "hot",
    },
    {
      key: "warm",
      label: "Mornos",
      value: warm,
      trend: todayWarm,
      icon: Thermometer,
      gradient: "from-yellow-500/20 to-yellow-500/5",
      iconBg: "bg-yellow-500/20",
      iconColor: "text-yellow-500",
      ringColor: "ring-yellow-500/50",
      filterValue: "warm",
    },
    {
      key: "cold",
      label: "Frios",
      value: cold,
      trend: todayCold,
      icon: Snowflake,
      gradient: "from-blue-400/20 to-blue-400/5",
      iconBg: "bg-blue-400/20",
      iconColor: "text-blue-400",
      ringColor: "ring-blue-400/50",
      filterValue: "cold",
    },
    {
      key: "unassigned",
      label: "Sem Corretor",
      value: unassigned,
      trend: null,
      icon: UserX,
      gradient: "from-muted to-muted/50",
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      ringColor: "ring-muted-foreground/50",
      filterValue: "unassigned",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 min-w-0 w-full", className)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isActive = activeFilter === stat.key;
        
        return (
          <button
            key={stat.key}
            onClick={() => handleClick(stat.key, stat.filterValue)}
            className={cn(
              "relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 min-w-0",
              "bg-gradient-to-br border",
              stat.gradient,
              isActive
                ? `ring-2 ${stat.ringColor} border-transparent shadow-lg scale-[1.02]`
                : "border-border/50 hover:border-border hover:shadow-md hover:scale-[1.01]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            )}
          >
            {/* Background glow effect */}
            <div
              className={cn(
                "absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-30 transition-opacity",
                stat.iconBg,
                isActive && "opacity-50"
              )}
            />

            <div className="relative flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {stat.value}
                </p>
                {stat.trend !== null && stat.trend > 0 && (
                  <div className="flex items-center gap-1 text-xs font-medium text-success">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{stat.trend} hoje</span>
                  </div>
                )}
                {stat.trend !== null && stat.trend === 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>0 hoje</span>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "flex items-center justify-center rounded-xl p-2.5 transition-all duration-300",
                  stat.iconBg,
                  isActive && "scale-110"
                )}
              >
                <Icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </div>

            {/* Active indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50" />
            )}
          </button>
        );
      })}
    </div>
  );
};
