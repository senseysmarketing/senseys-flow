import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import LeadForm from "./LeadForm";
import type { LeadFormValues, LeadStatus } from "@/types/leads";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: LeadStatus[];
  canAssignLeads: boolean;
  onSuccess: () => void;
}

const CreateLeadDialog = ({ open, onOpenChange, statuses, canAssignLeads, onSuccess }: CreateLeadDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: LeadFormValues) => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const statusId = data.status_id || (statuses.length > 0 ? statuses[0].id : null);

      // Duplicate detection
      let isDuplicate = false;
      let duplicateOfLeadId: string | null = null;
      const phoneSuffix = data.phone.replace(/\D/g, "").slice(-9);

      if (phoneSuffix.length >= 9) {
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("id, phone, email, created_at")
          .eq("account_id", profile.account_id)
          .order("created_at", { ascending: false });

        if (existingLeads && existingLeads.length > 0) {
          const match = existingLeads.find((l) => {
            const existingSuffix = l.phone.replace(/\D/g, "").slice(-9);
            if (existingSuffix.length >= 9 && existingSuffix === phoneSuffix) return true;
            if (data.email && l.email && data.email.toLowerCase() === l.email.toLowerCase()) return true;
            return false;
          });
          if (match) {
            isDuplicate = true;
            duplicateOfLeadId = match.id;
          }
        }
      }

      const { data: insertedLead, error } = await supabase
        .from("leads")
        .insert([{
          ...data,
          status_id: statusId,
          account_id: profile.account_id,
          is_duplicate: isDuplicate,
          duplicate_of_lead_id: duplicateOfLeadId,
        }])
        .select("id")
        .single();

      if (error) throw error;

      // Apply distribution rules
      let assignedBrokerId: string | undefined;
      try {
        const distResult = await supabase.functions.invoke("apply-distribution-rules", {
          body: { lead_id: insertedLead.id, account_id: profile.account_id },
        });
        if (distResult.data?.success) assignedBrokerId = distResult.data.broker_id;
      } catch (e) {
        console.error("Distribution error:", e);
      }

      // Send notification
      try {
        await supabase.functions.invoke("notify-new-lead", {
          body: {
            lead_id: insertedLead.id,
            lead_name: data.name,
            lead_phone: data.phone,
            lead_email: data.email,
            lead_temperature: data.temperature || "cold",
            lead_origem: data.origem || "Manual",
            property_name: null,
            account_id: profile.account_id,
            assigned_broker_id: assignedBrokerId,
          },
        });
      } catch (e) {
        console.error("Notification error:", e);
      }

      // WhatsApp automation
      try {
        const { data: automationRule } = await supabase
          .from("whatsapp_automation_rules")
          .select("*")
          .eq("account_id", profile.account_id)
          .eq("trigger_type", "new_lead")
          .eq("is_active", true)
          .single();

        if (automationRule) {
          const sources = automationRule.trigger_sources || { manual: true };
          const manualEnabled = typeof sources === "object" && sources !== null
            ? (sources as Record<string, boolean>).manual !== false
            : true;

          if (manualEnabled) {
            const { data: session } = await supabase
              .from("whatsapp_sessions" as any)
              .select("status")
              .eq("account_id", profile.account_id)
              .maybeSingle();

            if (session) {
              const stepsSnapshot: { greeting: any[]; followup: any[] } = { greeting: [], followup: [] };

              const { data: seqSteps } = await supabase
                .from("whatsapp_greeting_sequence_steps" as any)
                .select("*")
                .eq("automation_rule_id", automationRule.id)
                .eq("is_active", true)
                .order("position");

              if (seqSteps && seqSteps.length > 0) {
                for (const step of seqSteps as any[]) {
                  const { data: tmpl } = await supabase
                    .from("whatsapp_templates")
                    .select("template")
                    .eq("id", step.template_id)
                    .single();
                  stepsSnapshot.greeting.push({
                    delay_seconds: step.delay_seconds || 0,
                    template_id: step.template_id,
                    template_content: tmpl?.template || "",
                  });
                }
              } else if (automationRule.template_id) {
                const { data: tmpl } = await supabase
                  .from("whatsapp_templates")
                  .select("template")
                  .eq("id", automationRule.template_id)
                  .single();
                stepsSnapshot.greeting.push({
                  delay_seconds: 0,
                  template_id: automationRule.template_id,
                  template_content: tmpl?.template || "",
                });
              }

              const { data: followUpSteps } = await supabase
                .from("whatsapp_followup_steps")
                .select("*")
                .eq("account_id", profile.account_id)
                .eq("is_active", true)
                .order("position");

              if (followUpSteps && followUpSteps.length > 0) {
                for (const step of followUpSteps as any[]) {
                  const { data: tmpl } = await supabase
                    .from("whatsapp_templates")
                    .select("template")
                    .eq("id", step.template_id)
                    .single();
                  stepsSnapshot.followup.push({
                    delay_minutes: step.delay_minutes,
                    template_id: step.template_id,
                    template_content: tmpl?.template || "",
                  });
                }
              }

              if (stepsSnapshot.greeting.length > 0) {
                const delaySeconds = automationRule.delay_seconds || 0;
                await supabase.from("whatsapp_automation_control").insert({
                  account_id: profile.account_id,
                  lead_id: insertedLead.id,
                  automation_rule_id: automationRule.id,
                  phone: data.phone,
                  current_phase: "greeting",
                  current_step_position: 0,
                  status: "active",
                  next_execution_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
                  steps_snapshot: stepsSnapshot,
                });
                supabase.functions.invoke("process-whatsapp-queue").catch((e: any) =>
                  console.log("Queue processing trigger:", e)
                );
              }
            }
          }
        }
      } catch (e) {
        console.log("WhatsApp automation check error:", e);
      }

      toast({ title: "Lead criado com sucesso!", description: "O lead foi adicionado ao sistema." });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar lead", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Lead</DialogTitle>
          <DialogDescription>
            Preencha as informações do lead. Nome e telefone são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <LeadForm
          statuses={statuses}
          canAssignLeads={canAssignLeads}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Criar Lead"
          loadingLabel="Criando..."
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateLeadDialog;
