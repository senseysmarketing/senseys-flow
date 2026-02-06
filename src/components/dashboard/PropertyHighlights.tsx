import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Building2, ChevronRight, Users, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
interface PropertyWithMetrics {
  id: string;
  title: string;
  type: string;
  status: string;
  neighborhood?: string;
  city?: string;
  totalLeads: number;
  hotLeads: number;
  investimento?: number;
  cpl?: number;
}

interface PropertyHighlightsProps {
  maxItems?: number;
  className?: string;
}

export const PropertyHighlights = ({
  maxItems = 3,
  className,
}: PropertyHighlightsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [properties, setProperties] = useState<PropertyWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPropertyMetrics = async () => {
      setLoading(true);
      try {
        // Fetch properties and leads in parallel
        const [propertiesResult, leadsResult] = await Promise.all([
          supabase
            .from("properties")
            .select("id, title, type, status, neighborhood, city")
            .eq("status", "disponivel")
            .order("created_at", { ascending: false }),
          supabase
            .from("leads")
            .select("property_id, temperature"),
        ]);

        if (propertiesResult.error) throw propertiesResult.error;
        if (leadsResult.error) throw leadsResult.error;

        const propertiesData = propertiesResult.data || [];
        const leadsData = leadsResult.data || [];

        // Calculate metrics per property
        const propertiesWithMetrics: PropertyWithMetrics[] = propertiesData.map((property) => {
          const propertyLeads = leadsData.filter((l) => l.property_id === property.id);
          const hotLeads = propertyLeads.filter((l) => l.temperature === "hot").length;

          return {
            id: property.id,
            title: property.title,
            type: property.type,
            status: property.status,
            neighborhood: property.neighborhood || undefined,
            city: property.city || undefined,
            totalLeads: propertyLeads.length,
            hotLeads,
          };
        });

        // Sort by total leads (most leads first)
        propertiesWithMetrics.sort((a, b) => b.totalLeads - a.totalLeads);

        setProperties(propertiesWithMetrics.slice(0, maxItems));
      } catch (error) {
        console.error("Error fetching property metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyMetrics();
  }, [user, maxItems]);

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <div className="h-6 bg-muted rounded w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-accent" />
            Imóveis em Destaque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Nenhum imóvel cadastrado</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate("/properties")}
            >
              Adicionar imóvel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-accent" />
          Imóveis em Destaque
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/properties")}
          className="gap-1"
        >
          Ver todos
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {properties.map((property, index) => (
            <div
              key={property.id}
              className={cn(
                "p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer",
                isMobile ? "flex flex-col gap-2" : "flex items-center gap-3"
              )}
              onClick={() => navigate("/properties")}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Rank indicator */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{property.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {property.neighborhood || property.city || property.type}
                  </p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 flex-shrink-0",
                isMobile && "justify-end"
              )}>
                {/* Total leads */}
                <div className="flex items-center gap-1 text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{property.totalLeads}</span>
                </div>

                {/* Hot leads */}
                {property.hotLeads > 0 && (
                  <div className="flex items-center gap-1 text-xs text-warning">
                    <Flame className="h-3.5 w-3.5" />
                    <span className="font-medium">{property.hotLeads}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
