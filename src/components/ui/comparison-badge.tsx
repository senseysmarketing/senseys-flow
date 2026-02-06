import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonBadgeProps {
  value: number;
  previousValue: number;
  format?: "percentage" | "absolute" | "currency";
  showIcon?: boolean;
  showValue?: boolean;
  className?: string;
  invertColors?: boolean; // For metrics where lower is better (like CPL)
}

export const ComparisonBadge = ({
  value,
  previousValue,
  format = "percentage",
  showIcon = true,
  showValue = true,
  className,
  invertColors = false,
}: ComparisonBadgeProps) => {
  if (previousValue === 0 && value === 0) {
    return null;
  }

  const difference = value - previousValue;
  const percentageChange = previousValue !== 0 
    ? ((difference / previousValue) * 100) 
    : value > 0 ? 100 : 0;

  const isPositive = difference > 0;
  const isNeutral = difference === 0;

  // Determine color based on whether higher values are good or bad
  const isGood = invertColors ? !isPositive : isPositive;

  const formatValue = () => {
    if (format === "percentage") {
      return `${Math.abs(percentageChange).toFixed(0)}%`;
    }
    if (format === "currency") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.abs(difference));
    }
    return Math.abs(difference).toString();
  };

  if (isNeutral) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground",
          className
        )}
      >
        {showIcon && <Minus className="h-3 w-3" />}
        {showValue && <span>0%</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isGood 
          ? "text-success" 
          : "text-destructive",
        className
      )}
    >
      {showIcon && (
        isPositive 
          ? <TrendingUp className="h-3 w-3" /> 
          : <TrendingDown className="h-3 w-3" />
      )}
      {showValue && (
        <span>
          {isPositive ? "+" : "-"}{formatValue()}
        </span>
      )}
    </span>
  );
};
