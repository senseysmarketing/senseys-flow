import { useEffect, useState } from "react";
import { Building2, CheckCircle, Clock, DollarSign, Users, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface PropertyKPIData {
  totalProperties: number;
  availableCount: number;
  reservedCount: number;
  totalLeads: number;
  hotLeads: number;
  totalInvestment: number;
}

const KPI_CONFIG = [
  { key: "totalProperties" as const, label: "Imóveis", icon: Building2, color: "text-white/60" },
  { key: "availableCount" as const, label: "Disponíveis", icon: CheckCircle, color: "text-emerald-400" },
  { key: "reservedCount" as const, label: "Reservados", icon: Clock, color: "text-yellow-400" },
  { key: "totalLeads" as const, label: "Leads", icon: Users, color: "text-white/60" },
  { key: "hotLeads" as const, label: "Quentes", icon: Flame, color: "text-red-400" },
];

export function PropertiesKPIs() {
  const [data, setData] = useState<PropertyKPIData>({
    totalProperties: 0,
    availableCount: 0,
    reservedCount: 0,
    totalLeads: 0,
    hotLeads: 0,
    totalInvestment: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKPIs();
  }, []);

  const fetchKPIs = async () => {
    try {
      const { data: properties, error: propError } = await supabase
        .from("properties")
        .select("id, status, reference_code");
      if (propError) throw propError;

      const totalProperties = properties?.length || 0;
      const availableCount = properties?.filter(p => p.status === "disponivel").length || 0;
      const reservedCount = properties?.filter(p => p.status === "reservado").length || 0;

      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, temperature, property_id")
        .not("property_id", "is", null);
      if (leadsError) throw leadsError;

      const totalLeads = leads?.length || 0;
      const hotLeads = leads?.filter(l => l.temperature === "hot").length || 0;

      const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const dateTo = format(new Date(), "yyyy-MM-dd");

      const { data: formMappings } = await supabase
        .from("meta_form_property_mapping")
        .select("form_id, reference_code");

      const { data: adInsights } = await supabase
        .from("meta_ad_insights_by_ad")
        .select("form_id, spend")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .not("form_id", "is", null);

      let totalInvestment = 0;
      const propertyRefs = new Set(properties?.map(p => p.reference_code).filter(Boolean));
      for (const insight of adInsights || []) {
        const mapping = formMappings?.find(m => m.form_id === insight.form_id);
        if (mapping?.reference_code && propertyRefs.has(mapping.reference_code)) {
          totalInvestment += Number(insight.spend || 0);
        }
      }

      setData({ totalProperties, availableCount, reservedCount, totalLeads, hotLeads, totalInvestment });
    } catch (error) {
      console.error("Error fetching property KPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  if (loading) {
    return <div className="h-14 bg-white/5 rounded-xl animate-pulse" />;
  }

  return (
    <div className="flex items-center bg-[hsl(var(--card))]/30 backdrop-blur-sm border border-white/10 rounded-xl divide-x divide-white/10 overflow-x-auto">
      {KPI_CONFIG.map(({ key, label, icon: Icon, color }) => (
        <div key={key} className="flex-1 flex items-center gap-2 px-4 py-3 min-w-0">
          <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tabular-nums">{data[key]}</p>
            <p className="text-[10px] text-white/40 truncate">{label}</p>
          </div>
        </div>
      ))}
      {/* Investment KPI */}
      <div className="flex-1 flex items-center gap-2 px-4 py-3 min-w-0">
        <DollarSign className="h-4 w-4 flex-shrink-0 text-emerald-400" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(data.totalInvestment)}</p>
          <p className="text-[10px] text-white/40 truncate">Invest. 30d</p>
        </div>
      </div>
    </div>
  );
}
