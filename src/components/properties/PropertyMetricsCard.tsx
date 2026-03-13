import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Car, Eye, Edit2, Trash2, Users, Flame, DollarSign, TrendingUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface Property {
  id: string;
  title: string;
  type: string;
  transaction_type: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  sale_price: number | null;
  rent_price: number | null;
  status: string;
  reference_code: string | null;
  assigned_broker_id: string | null;
}

interface PropertyMetrics {
  leadCount: number;
  hotLeads: number;
  investment: number;
  cpl: number;
}

interface PropertyMetricsCardProps {
  property: Property;
  brokerName?: string;
  statusInfo: { label: string; color: string };
  typeInfo?: { value: string; label: string };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PropertyMetricsCard({
  property,
  brokerName,
  statusInfo,
  typeInfo,
  onView,
  onEdit,
  onDelete,
}: PropertyMetricsCardProps) {
  const [metrics, setMetrics] = useState<PropertyMetrics>({
    leadCount: 0,
    hotLeads: 0,
    investment: 0,
    cpl: 0,
  });

  useEffect(() => {
    fetchMetrics();
  }, [property.id]);

  const fetchMetrics = async () => {
    try {
      // Fetch leads for this property
      const { data: leads } = await supabase
        .from("leads")
        .select("id, temperature")
        .eq("property_id", property.id);

      const leadCount = leads?.length || 0;
      const hotLeads = leads?.filter(l => l.temperature === "hot").length || 0;

      // Fetch investment if property has reference_code
      let investment = 0;
      if (property.reference_code) {
        const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
        const dateTo = format(new Date(), "yyyy-MM-dd");

        const { data: formMappings } = await supabase
          .from("meta_form_property_mapping")
          .select("form_id")
          .eq("reference_code", property.reference_code);

        if (formMappings && formMappings.length > 0) {
          const formIds = formMappings.map(m => m.form_id);
          const { data: adInsights } = await supabase
            .from("meta_ad_insights_by_ad")
            .select("spend")
            .gte("date", dateFrom)
            .lte("date", dateTo)
            .in("form_id", formIds);

          investment = adInsights?.reduce((acc, i) => acc + Number(i.spend || 0), 0) || 0;
        }
      }

      const cpl = leadCount > 0 ? investment / leadCount : 0;

      setMetrics({ leadCount, hotLeads, investment, cpl });
    } catch (error) {
      console.error("Error fetching property metrics:", error);
    }
  };

  const formatPrice = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-[0_0_20px_rgba(129,175,209,0.1)] hover:border-[#81afd1]/30 transition-all group bg-[#5a5f65]/80 backdrop-blur-md border border-white/10" onClick={onView}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate text-white group-hover:text-[#81afd1] transition-colors">
              {property.title}
            </CardTitle>
            {property.neighborhood && property.city && (
              <CardDescription className="flex items-center gap-1 mt-1 text-[#a6c8e1]/70">
                <MapPin className="h-3 w-3" />
                {property.neighborhood}, {property.city}
              </CardDescription>
            )}
          </div>
          <Badge className={`shrink-0 ${
            statusInfo.label === 'Disponível' 
              ? 'bg-transparent border border-emerald-400/50 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.2)]' 
              : `${statusInfo.color} text-white`
          }`}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Property specs */}
        <div className="flex items-center gap-4 text-sm text-[#a6c8e1]/70">
          <Badge variant="outline" className="border-white/10 text-[#a6c8e1]">{typeInfo?.label || property.type}</Badge>
          {property.area_m2 && <span>{property.area_m2}m²</span>}
          {property.bedrooms && (
            <span className="flex items-center gap-1">
              <Bed className="h-3 w-3" /> {property.bedrooms}
            </span>
          )}
          {property.bathrooms && (
            <span className="flex items-center gap-1">
              <Bath className="h-3 w-3" /> {property.bathrooms}
            </span>
          )}
          {property.parking_spots && (
            <span className="flex items-center gap-1">
              <Car className="h-3 w-3" /> {property.parking_spots}
            </span>
          )}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 py-3 px-3 bg-black/20 rounded-xl border border-white/5">
          <div className="text-center">
            <Users className="h-3 w-3 text-[#a6c8e1] mx-auto mb-1" />
            <p className="text-sm font-semibold text-white tabular-nums">{metrics.leadCount}</p>
            <p className="text-[10px] text-[#a6c8e1]/60">Leads</p>
          </div>
          <div className="text-center">
            <Flame className="h-3 w-3 text-red-400 mx-auto mb-1" />
            <p className="text-sm font-semibold text-white tabular-nums">{metrics.hotLeads}</p>
            <p className="text-[10px] text-[#a6c8e1]/60">Quentes</p>
          </div>
          <div className="text-center">
            <DollarSign className="h-3 w-3 text-emerald-400 mx-auto mb-1" />
            <p className="text-sm font-semibold text-white tabular-nums">{formatCurrency(metrics.investment)}</p>
            <p className="text-[10px] text-[#a6c8e1]/60">Invest.</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-[#81afd1]" />
            </div>
            <p className="text-sm font-semibold text-white tabular-nums">{formatCurrency(metrics.cpl)}</p>
            <p className="text-[10px] text-[#a6c8e1]/60">CPL</p>
          </div>
        </div>

        {/* Mini sparkline */}
        {metrics.investment > 0 && (
          <div className="h-8 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[0, 2, 1, 4, 3, 5, 4, 6].map((v, i) => ({ v, i }))}>
                <Line type="monotone" dataKey="v" stroke="#81afd1" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pricing */}
        <div className="space-y-1">
          {property.sale_price && (
            <p className="text-lg font-bold text-[#81afd1]">
              Venda: {formatPrice(property.sale_price)}
            </p>
          )}
          {property.rent_price && (
            <p className="text-sm text-[#a6c8e1]/70">
              Aluguel: {formatPrice(property.rent_price)}/mês
            </p>
          )}
        </div>

        {brokerName && (
          <p className="text-xs text-[#a6c8e1]/60">
            Corretor: {brokerName}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            Detalhes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover imóvel?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
