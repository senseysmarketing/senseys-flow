import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Car, Ruler, Eye, Edit2, Trash2, Users, Flame, TrendingUp, Building2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

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
  image_urls?: any;
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

const STATUS_STYLES: Record<string, string> = {
  "Disponível": "bg-emerald-500/10 border border-emerald-400/40 text-emerald-400",
  "Reservado": "bg-yellow-500/10 border border-yellow-400/40 text-yellow-400",
  "Vendido": "bg-blue-500/10 border border-blue-400/40 text-blue-400",
  "Alugado": "bg-purple-500/10 border border-purple-400/40 text-purple-400",
  "Inativo": "bg-white/5 border border-white/20 text-white/50",
};

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
      const { data: leads } = await supabase
        .from("leads")
        .select("id, temperature")
        .eq("property_id", property.id);

      const leadCount = leads?.length || 0;
      const hotLeads = leads?.filter(l => l.temperature === "hot").length || 0;

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
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  const neonClass = STATUS_STYLES[statusInfo.label] || STATUS_STYLES["Inativo"];
  const location = [property.neighborhood, property.city].filter(Boolean).join(", ");
  const price = formatPrice(property.sale_price) || formatPrice(property.rent_price);
  const isRentOnly = !property.sale_price && !!property.rent_price;

  // Check if property has real images
  const imageUrls = property.image_urls as string[] | null;
  const firstImage = imageUrls && imageUrls.length > 0 ? imageUrls[0] : null;

  return (
    <div
      className="group rounded-xl overflow-hidden bg-[hsl(var(--card))]/30 backdrop-blur-md border border-white/10 cursor-pointer transition-all duration-300 hover:border-[#81afd1]/40 hover:shadow-[0_0_24px_rgba(129,175,209,0.12)]"
      onClick={onView}
    >
      {/* Thumbnail */}
      <div className="relative h-40 overflow-hidden">
        {firstImage ? (
          <img
            src={firstImage}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[hsl(var(--card))] to-[#81afd1]/15 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
            <Building2 className="h-12 w-12 text-white/[0.07]" />
          </div>
        )}
        {/* Status badge neon */}
        <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-1 rounded-full ${neonClass}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Title + Price */}
        <div>
          <h3 className="text-sm font-bold text-white truncate group-hover:text-[#81afd1] transition-colors">
            {property.title}
          </h3>
          {price && (
            <p className="text-lg font-bold text-[#81afd1] tabular-nums mt-0.5">
              {isRentOnly ? `${price}/mês` : price}
            </p>
          )}
        </div>

        {/* Location */}
        {location && (
          <div className="flex items-center gap-1 text-white/50">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="text-xs truncate">{location}</span>
          </div>
        )}

        {/* Specs pills */}
        <div className="flex flex-wrap gap-1.5">
          {typeInfo && (
            <span className="bg-white/5 px-2 py-1 rounded-md text-xs text-white/60">
              {typeInfo.label}
            </span>
          )}
          {property.bedrooms != null && (
            <span className="bg-white/5 px-2 py-1 rounded-md text-xs text-white/60 flex items-center gap-1">
              <Bed className="h-3 w-3" /> {property.bedrooms}
            </span>
          )}
          {property.bathrooms != null && (
            <span className="bg-white/5 px-2 py-1 rounded-md text-xs text-white/60 flex items-center gap-1">
              <Bath className="h-3 w-3" /> {property.bathrooms}
            </span>
          )}
          {property.parking_spots != null && (
            <span className="bg-white/5 px-2 py-1 rounded-md text-xs text-white/60 flex items-center gap-1">
              <Car className="h-3 w-3" /> {property.parking_spots}
            </span>
          )}
          {property.area_m2 != null && (
            <span className="bg-white/5 px-2 py-1 rounded-md text-xs text-white/60 flex items-center gap-1">
              <Ruler className="h-3 w-3" /> {property.area_m2}m²
            </span>
          )}
        </div>

        {/* Metrics footer */}
        <div className="flex items-center gap-4 text-xs text-white/40 border-t border-white/5 pt-3">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {metrics.leadCount}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-red-400/70" /> {metrics.hotLeads}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> CPL {formatCurrency(metrics.cpl)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="flex-1 h-8 text-xs text-white/50 hover:text-white hover:bg-white/5"
          >
            <Eye className="h-3 w-3 mr-1" />
            Detalhes
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400/60 hover:text-red-300 hover:bg-white/5"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover imóvel?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {brokerName && (
          <p className="text-[10px] text-white/30">Corretor: {brokerName}</p>
        )}
      </div>
    </div>
  );
}
