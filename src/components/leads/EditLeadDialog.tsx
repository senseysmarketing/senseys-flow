import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import LeadForm from "./LeadForm";
import type { Lead, LeadFormValues, LeadStatus } from "@/types/leads";

interface EditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  leads: Lead[];
  statuses: LeadStatus[];
  canAssignLeads: boolean;
  onSuccess: () => void;
}

const EditLeadDialog = ({ open, onOpenChange, lead, leads, statuses, canAssignLeads, onSuccess }: EditLeadDialogProps) => {
  const [loading, setLoading] = useState(false);

  if (!lead) return null;

  const handleSubmit = async (data: LeadFormValues) => {
    setLoading(true);

    try {
      const leadBefore = leads.find((l) => l.id === lead.id);
      const oldTemperature = leadBefore?.temperature;

      const { error } = await supabase
        .from("leads")
        .update({
          name: data.name,
          phone: data.phone,
          email: data.email,
          interesse: data.interesse,
          observacoes: data.observacoes,
          origem: data.origem,
          campanha: data.campanha,
          conjunto: data.conjunto,
          anuncio: data.anuncio,
          status_id: data.status_id,
          temperature: data.temperature,
          assigned_broker_id: data.assigned_broker_id,
          property_id: data.property_id,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast({ title: "Lead atualizado com sucesso!", description: "As informações do lead foram atualizadas." });

      // Send Meta CAPI event if temperature changed to "hot"
      if (oldTemperature !== "hot" && data.temperature === "hot") {
        try {
          await supabase.functions.invoke("send-meta-event", {
            body: {
              lead_id: lead.id,
              event_name: "LeadQualificado",
              custom_data: { lead_type: "qualified" },
            },
          });
        } catch (capiError) {
          console.error("Error sending Meta CAPI event:", capiError);
        }
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar lead", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const defaultValues: Partial<LeadFormValues> = {
    name: lead.name,
    phone: lead.phone,
    email: lead.email || "",
    interesse: lead.interesse || "",
    observacoes: lead.observacoes || "",
    origem: lead.origem || "",
    campanha: lead.campanha || "",
    conjunto: lead.conjunto || "",
    anuncio: lead.anuncio || "",
    status_id: lead.status_id || "",
    temperature: (lead.temperature as "hot" | "warm" | "cold") || "warm",
    assigned_broker_id: lead.assigned_broker_id || null,
    property_id: lead.property_id || null,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription>Atualize as informações do lead.</DialogDescription>
        </DialogHeader>
        <LeadForm
          key={lead.id}
          defaultValues={defaultValues}
          statuses={statuses}
          canAssignLeads={canAssignLeads}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Atualizar Lead"
          loadingLabel="Atualizando..."
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditLeadDialog;
