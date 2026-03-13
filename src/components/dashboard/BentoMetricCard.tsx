import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface BentoMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  sparklineData?: number[];
  className?: string;
}

export const BentoMetricCard = ({
  title,
  value,
  icon: Icon,
  sparklineData,
  className,
}: BentoMetricCardProps) => {
  const chartData = (sparklineData || [0, 2, 1, 4, 3, 5, 4]).map((v, i) => ({ v, i }));

  return (
    <div className={cn(
      "stat-card flex flex-col justify-between gap-3",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <Icon className="h-4 w-4 text-primary/60" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-3xl font-bold text-foreground tabular-nums">{value}</span>
        <div className="w-20 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="hsl(207, 45%, 66%)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};