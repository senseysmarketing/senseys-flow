import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Clock, 
  Building2,
  Users,
  Zap,
  LucideIcon
} from "lucide-react";

export interface Insight {
  id: string;
  type: "warning" | "success" | "info" | "action";
  icon: LucideIcon;
  title: string;
  description: string;
  priority: number; // 1 = highest priority
  action?: {
    label: string;
    path?: string;
    onClick?: () => void;
  };
  metadata?: Record<string, any>;
}

interface UseInsightsReturn {
  insights: Insight[];
  loading: boolean;
  refresh: () => void;
}

export const useInsights = (): UseInsightsReturn => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const generateInsights = async () => {
      setLoading(true);
      const newInsights: Insight[] = [];

      try {
        // Get profile for account context
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_id")
          .eq("user_id", user.id)
          .single();

        if (!profile?.account_id) {
          setLoading(false);
          return;
        }

        // Fetch all necessary data in parallel
        const [
          leadsResult,
          propertiesResult,
          insightsResult,
          statusesResult
        ] = await Promise.all([
          supabase
            .from("leads")
            .select("id, name, phone, temperature, updated_at, created_at, status_id, property_id, assigned_broker_id")
            .order("created_at", { ascending: false }),
          supabase
            .from("properties")
            .select("id, title, reference_code, status"),
          supabase
            .from("meta_ad_insights")
            .select("spend, leads_count, cpl, date")
            .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
            .order("date", { ascending: false }),
          supabase
            .from("lead_status")
            .select("id, name")
        ]);

        const leads = leadsResult.data || [];
        const properties = propertiesResult.data || [];
        const adInsights = insightsResult.data || [];
        const statuses = statusesResult.data || [];

        const now = new Date();

        // 1. Hot leads without contact in 2+ days
        const hotLeadsWithoutContact = leads.filter(lead => {
          if (lead.temperature !== "hot") return false;
          const updatedAt = new Date(lead.updated_at);
          const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUpdate >= 2;
        });

        if (hotLeadsWithoutContact.length > 0) {
          newInsights.push({
            id: "hot-leads-no-contact",
            type: "action",
            icon: Flame,
            title: `${hotLeadsWithoutContact.length} lead${hotLeadsWithoutContact.length > 1 ? 's' : ''} quente${hotLeadsWithoutContact.length > 1 ? 's' : ''} sem contato`,
            description: "Leads quentes há mais de 2 dias sem atualização. Priorize o atendimento!",
            priority: 1,
            action: {
              label: "Ver leads",
              path: "/leads",
            },
            metadata: { count: hotLeadsWithoutContact.length },
          });
        }

        // 2. Leads without broker assigned
        const leadsWithoutBroker = leads.filter(lead => !lead.assigned_broker_id);
        if (leadsWithoutBroker.length >= 5) {
          newInsights.push({
            id: "leads-no-broker",
            type: "warning",
            icon: Users,
            title: `${leadsWithoutBroker.length} leads sem corretor`,
            description: "Atribua corretores para garantir atendimento rápido.",
            priority: 2,
            action: {
              label: "Atribuir",
              path: "/leads",
            },
          });
        }

        // 3. CPL Analysis - compare last 7 days vs previous 7 days
        if (adInsights.length > 0) {
          const last7Days = adInsights.slice(0, 7);
          const previous7Days = adInsights.slice(7, 14);

          const last7DaysAvgCPL = last7Days.reduce((acc, i) => acc + (i.cpl || 0), 0) / (last7Days.length || 1);
          const previous7DaysAvgCPL = previous7Days.reduce((acc, i) => acc + (i.cpl || 0), 0) / (previous7Days.length || 1);

          if (previous7DaysAvgCPL > 0 && last7DaysAvgCPL > previous7DaysAvgCPL * 1.3) {
            const increasePercent = Math.round(((last7DaysAvgCPL - previous7DaysAvgCPL) / previous7DaysAvgCPL) * 100);
            newInsights.push({
              id: "cpl-increase",
              type: "warning",
              icon: TrendingUp,
              title: `CPL aumentou ${increasePercent}%`,
              description: `O custo por lead subiu de R$ ${previous7DaysAvgCPL.toFixed(0)} para R$ ${last7DaysAvgCPL.toFixed(0)}. Revise suas campanhas.`,
              priority: 3,
              action: {
                label: "Ver relatórios",
                path: "/reports",
              },
            });
          } else if (previous7DaysAvgCPL > 0 && last7DaysAvgCPL < previous7DaysAvgCPL * 0.7) {
            const decreasePercent = Math.round(((previous7DaysAvgCPL - last7DaysAvgCPL) / previous7DaysAvgCPL) * 100);
            newInsights.push({
              id: "cpl-decrease",
              type: "success",
              icon: TrendingDown,
              title: `CPL reduziu ${decreasePercent}%`,
              description: `Excelente! O custo por lead caiu para R$ ${last7DaysAvgCPL.toFixed(0)}.`,
              priority: 5,
            });
          }
        }

        // 4. Today's leads performance
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayLeads = leads.filter(lead => new Date(lead.created_at) >= todayStart);
        
        if (todayLeads.length >= 5) {
          const hotToday = todayLeads.filter(l => l.temperature === "hot").length;
          newInsights.push({
            id: "today-leads",
            type: "success",
            icon: Zap,
            title: `${todayLeads.length} leads hoje!`,
            description: hotToday > 0 
              ? `${hotToday} lead${hotToday > 1 ? 's' : ''} quente${hotToday > 1 ? 's' : ''}. Ótimo dia!`
              : "Continue acompanhando o desempenho.",
            priority: 4,
          });
        }

        // 5. Properties without leads
        const propertyIdsWithLeads = new Set(leads.map(l => l.property_id).filter(Boolean));
        const activePropertiesWithoutLeads = properties.filter(p => 
          p.status === "disponivel" && !propertyIdsWithLeads.has(p.id)
        );

        if (activePropertiesWithoutLeads.length > 0 && properties.length > 0) {
          newInsights.push({
            id: "properties-no-leads",
            type: "info",
            icon: Building2,
            title: `${activePropertiesWithoutLeads.length} imóveis sem leads`,
            description: "Considere criar campanhas específicas para esses imóveis.",
            priority: 6,
            action: {
              label: "Ver imóveis",
              path: "/properties",
            },
          });
        }

        // 6. Old leads in initial status
        const initialStatus = statuses.find(s => 
          s.name.toLowerCase().includes("novo") || s.name.toLowerCase().includes("new")
        );
        
        if (initialStatus) {
          const oldNewLeads = leads.filter(lead => {
            if (lead.status_id !== initialStatus.id) return false;
            const createdAt = new Date(lead.created_at);
            const daysOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return daysOld >= 7;
          });

          if (oldNewLeads.length > 0) {
            newInsights.push({
              id: "old-new-leads",
              type: "warning",
              icon: Clock,
              title: `${oldNewLeads.length} leads parados`,
              description: `Leads há mais de 7 dias como "Novo Lead". Mova ou atualize!`,
              priority: 2,
              action: {
                label: "Ver leads",
                path: "/leads",
              },
            });
          }
        }

        // Sort by priority
        newInsights.sort((a, b) => a.priority - b.priority);

        setInsights(newInsights);
      } catch (error) {
        console.error("Error generating insights:", error);
      } finally {
        setLoading(false);
      }
    };

    generateInsights();
  }, [user, refreshTrigger]);

  return { insights, loading, refresh };
};
