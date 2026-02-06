import { useInsights, Insight } from "@/hooks/use-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const insightTypeStyles = {
  warning: "border-l-warning bg-warning/5",
  success: "border-l-success bg-success/5",
  info: "border-l-primary bg-primary/5",
  action: "border-l-destructive bg-destructive/5",
};

const insightIconStyles = {
  warning: "text-warning",
  success: "text-success",
  info: "text-primary",
  action: "text-destructive",
};

interface InsightsPanelProps {
  maxItems?: number;
  showHeader?: boolean;
  compact?: boolean;
  className?: string;
}

export const InsightsPanel = ({
  maxItems = 5,
  showHeader = true,
  compact = false,
  className,
}: InsightsPanelProps) => {
  const { insights, loading, refresh } = useInsights();
  const navigate = useNavigate();

  const displayedInsights = insights.slice(0, maxItems);

  const handleInsightAction = (insight: Insight) => {
    if (insight.action?.onClick) {
      insight.action.onClick();
    } else if (insight.action?.path) {
      navigate(insight.action.path);
    }
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <div className="h-6 bg-muted rounded w-40" />
          </CardHeader>
        )}
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className={cn("", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights & Recomendações
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Lightbulb className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Tudo em dia! Nenhuma ação pendente.</p>
            <p className="text-xs mt-1">Continue acompanhando seu desempenho.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      {showHeader && (
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights & Recomendações
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea className={compact ? "max-h-[300px]" : "max-h-[400px]"}>
          <div className="space-y-2 p-4 pt-0">
            {displayedInsights.map((insight) => {
              const Icon = insight.icon;
              return (
                <div
                  key={insight.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-l-4 transition-all",
                    insightTypeStyles[insight.type],
                    insight.action && "cursor-pointer hover:shadow-md"
                  )}
                  onClick={() => insight.action && handleInsightAction(insight)}
                >
                  <div className={cn("mt-0.5", insightIconStyles[insight.type])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{insight.title}</h4>
                    {!compact && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {insight.description}
                      </p>
                    )}
                  </div>
                  {insight.action && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {insights.length > maxItems && (
          <div className="p-3 pt-0 border-t">
            <p className="text-xs text-center text-muted-foreground">
              +{insights.length - maxItems} mais insights
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
