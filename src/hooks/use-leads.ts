import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";
import type { Lead, LeadStatus } from "@/types/leads";

export const useLeads = () => {
  const { user } = useAuth();
  const { hasPermission, isOwner } = usePermissions();
  const queryClient = useQueryClient();
  const canViewAll = hasPermission("leads.view_all") || isOwner;

  const statusesQuery = useQuery<LeadStatus[]>({
    queryKey: ["lead-statuses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("*")
        .order("position");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const leadsQuery = useQuery<Lead[]>({
    queryKey: ["leads", user?.id, canViewAll],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select(`
          *,
          lead_status ( name, color ),
          properties ( id, title )
        `)
        .order("created_at", { ascending: false });

      if (!canViewAll) {
        query = query.eq("assigned_broker_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const statuses = statusesQuery.data || [];
      const defaultStatus = statuses.find((s) => s.is_default) || statuses[0];

      // Assign default status to leads without one
      const leadsWithoutStatus = (data || []).filter((l) => !l.status_id);
      if (leadsWithoutStatus.length > 0 && defaultStatus) {
        const updatePromises = leadsWithoutStatus.map((lead) =>
          supabase.from("leads").update({ status_id: defaultStatus.id }).eq("id", lead.id)
        );
        await Promise.all(updatePromises);
      }

      return (data || []).map((lead) => ({
        ...lead,
        status_id: lead.status_id || defaultStatus?.id,
      })) as Lead[];
    },
    enabled: !!user && statusesQuery.isSuccess,
    staleTime: 30_000,
  });

  const deleteLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lead deletado com sucesso!", description: "O lead foi removido do sistema." });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao deletar lead", description: error.message });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ leadId, statusId }: { leadId: string; statusId: string }) => {
      const leadBefore = leadsQuery.data?.find((l) => l.id === leadId);
      const oldStatusId = leadBefore?.status_id;

      const { error } = await supabase
        .from("leads")
        .update({ status_id: statusId })
        .eq("id", leadId);
      if (error) throw error;

      // Send Meta CAPI event if mapping exists
      if (oldStatusId !== statusId) {
        try {
          const { data: mapping } = await supabase
            .from("meta_event_mappings")
            .select("event_name, lead_type, is_active")
            .eq("status_id", statusId)
            .eq("is_active", true)
            .single();

          if (mapping) {
            await supabase.functions.invoke("send-meta-event", {
              body: {
                lead_id: leadId,
                event_name: mapping.event_name,
                custom_data: mapping.lead_type ? { lead_type: mapping.lead_type } : {},
              },
            });
          }
        } catch (capiError) {
          console.error("Error sending Meta CAPI event:", capiError);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!", description: "O status do lead foi alterado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao alterar status", description: error.message });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  return {
    leads: leadsQuery.data || [],
    statuses: statusesQuery.data || [],
    isLoading: leadsQuery.isLoading || statusesQuery.isLoading,
    deleteLead,
    changeStatus,
    refresh,
  };
};
