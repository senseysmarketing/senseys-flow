import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { usePermissions } from "./use-permissions";

export interface PriorityLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  temperature: "hot" | "warm" | "cold";
  daysSinceUpdate: number;
  daysSinceCreation: number;
  status_id?: string;
  status_name?: string;
  status_color?: string;
  property_title?: string;
  assigned_broker_name?: string;
  urgency: "critical" | "high" | "medium" | "low";
}

interface UseLeadPrioritiesReturn {
  priorityLeads: PriorityLead[];
  loading: boolean;
  stats: {
    critical: number;
    high: number;
    medium: number;
    total: number;
  };
  markAsContacted: (leadId: string) => Promise<void>;
  refresh: () => void;
}

export const useLeadPriorities = (limit: number = 10): UseLeadPrioritiesReturn => {
  const { user } = useAuth();
  const { hasPermission, isOwner } = usePermissions();
  const [priorityLeads, setPriorityLeads] = useState<PriorityLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPriorityLeads = async () => {
      setLoading(true);

      try {
        let query = supabase
          .from("leads")
          .select(`
            id,
            name,
            phone,
            email,
            temperature,
            updated_at,
            created_at,
            status_id,
            property_id,
            assigned_broker_id,
            lead_status:lead_status(name, color),
            properties:properties(title),
            broker:profiles!leads_assigned_broker_id_fkey(full_name)
          `)
          .order("updated_at", { ascending: true });

        // Filtrar por broker se não tem permissão de ver todos
        const canViewAll = hasPermission('leads.view_all') || isOwner;
        if (!canViewAll && user) {
          query = query.eq('assigned_broker_id', user.id);
        }

        const { data: leads, error } = await query;

        if (error) throw error;

        const now = new Date();
        
        const processedLeads: PriorityLead[] = (leads || []).map(lead => {
          const updatedAt = new Date(lead.updated_at);
          const createdAt = new Date(lead.created_at);
          const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
          const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

          // Calculate urgency based on temperature and days without update
          let urgency: PriorityLead["urgency"] = "low";
          
          const temp = (lead.temperature || "warm") as "hot" | "warm" | "cold";
          
          if (temp === "hot") {
            if (daysSinceUpdate >= 2) urgency = "critical";
            else if (daysSinceUpdate >= 1) urgency = "high";
            else urgency = "medium";
          } else if (temp === "warm") {
            if (daysSinceUpdate >= 5) urgency = "high";
            else if (daysSinceUpdate >= 3) urgency = "medium";
            else urgency = "low";
          } else {
            if (daysSinceUpdate >= 7) urgency = "medium";
            else urgency = "low";
          }

          return {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email || undefined,
            temperature: temp,
            daysSinceUpdate,
            daysSinceCreation,
            status_id: lead.status_id || undefined,
            status_name: lead.lead_status?.name,
            status_color: lead.lead_status?.color,
            property_title: lead.properties?.title,
            assigned_broker_name: lead.broker?.full_name || undefined,
            urgency,
          };
        });

        // Sort by urgency (critical first) then by days since update
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        processedLeads.sort((a, b) => {
          const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          if (urgencyDiff !== 0) return urgencyDiff;
          return b.daysSinceUpdate - a.daysSinceUpdate;
        });

        // Filter to only show leads that need attention (not low urgency)
        const needsAttention = processedLeads.filter(l => l.urgency !== "low");

        setPriorityLeads(needsAttention.slice(0, limit));
      } catch (error) {
        console.error("Error fetching priority leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPriorityLeads();
  }, [user, limit, refreshTrigger]);

  const markAsContacted = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;

      // Log activity
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user?.id)
        .single();

      if (profile) {
        await supabase.from("lead_activities").insert({
          lead_id: leadId,
          account_id: profile.account_id,
          activity_type: "contact",
          description: "Lead marcado como contatado",
          created_by: user?.id,
        });
      }

      refresh();
    } catch (error) {
      console.error("Error marking lead as contacted:", error);
      throw error;
    }
  };

  const stats = {
    critical: priorityLeads.filter(l => l.urgency === "critical").length,
    high: priorityLeads.filter(l => l.urgency === "high").length,
    medium: priorityLeads.filter(l => l.urgency === "medium").length,
    total: priorityLeads.length,
  };

  return { priorityLeads, loading, stats, markAsContacted, refresh };
};
