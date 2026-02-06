import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ComparisonBadge } from "./comparison-badge";

interface MiniMetricCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  icon?: LucideIcon;
  iconColor?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  invertColors?: boolean;
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: "bg-muted/50 text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

const iconVariantStyles = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export const MiniMetricCard = ({
  title,
  value,
  previousValue,
  currentValue,
  icon: Icon,
  iconColor,
  variant = "default",
  invertColors = false,
  className,
  onClick,
}: MiniMetricCardProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl p-3 transition-all",
        variantStyles[variant],
        onClick && "cursor-pointer hover:scale-[1.02] hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      {Icon && (
        <div className={cn("flex-shrink-0", iconColor || iconVariantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{title}</p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{value}</span>
          {previousValue !== undefined && currentValue !== undefined && (
            <ComparisonBadge
              value={currentValue}
              previousValue={previousValue}
              invertColors={invertColors}
            />
          )}
        </div>
      </div>
    </div>
  );
};
