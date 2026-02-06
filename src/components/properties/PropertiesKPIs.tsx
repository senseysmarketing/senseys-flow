import { useEffect, useState } from "react";
import { Building2, CheckCircle, Clock, DollarSign, Users, Flame } from "lucide-react";
import { MiniMetricCard } from "@/components/ui/mini-metric-card";
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
      // Fetch properties
      const { data: properties, error: propError } = await supabase
        .from("properties")
        .select("id, status, reference_code");

      if (propError) throw propError;

      const totalProperties = properties?.length || 0;
      const availableCount = properties?.filter(p => p.status === "disponivel").length || 0;
      const reservedCount = properties?.filter(p => p.status === "reservado").length || 0;

      // Fetch leads linked to properties
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, temperature, property_id")
        .not("property_id", "is", null);

      if (leadsError) throw leadsError;

      const totalLeads = leads?.length || 0;
      const hotLeads = leads?.filter(l => l.temperature === "hot").length || 0;

      // Fetch investment from Meta insights (last 30 days)
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

      setData({
        totalProperties,
        availableCount,
        reservedCount,
        totalLeads,
        hotLeads,
        totalInvestment,
      });
    } catch (error) {
      console.error("Error fetching property KPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <MiniMetricCard
        title="Total de Imóveis"
        value={data.totalProperties}
        icon={Building2}
      />
      <MiniMetricCard
        title="Disponíveis"
        value={data.availableCount}
        icon={CheckCircle}
        iconColor="text-green-500"
      />
      <MiniMetricCard
        title="Reservados"
        value={data.reservedCount}
        icon={Clock}
        iconColor="text-yellow-500"
      />
      <MiniMetricCard
        title="Leads Vinculados"
        value={data.totalLeads}
        icon={Users}
      />
      <MiniMetricCard
        title="Leads Quentes"
        value={data.hotLeads}
        icon={Flame}
        iconColor="text-red-500"
      />
      <MiniMetricCard
        title="Investimento (30d)"
        value={formatCurrency(data.totalInvestment)}
        icon={DollarSign}
        iconColor="text-green-500"
      />
    </div>
  );
}
