import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const DISQUALIFICATION_REASONS = [
  { key: "sem_interesse", label: "Sem interesse real" },
  { key: "sem_capacidade_financeira", label: "Sem capacidade financeira" },
  { key: "fora_perfil", label: "Fora do perfil de imóveis" },
  { key: "nao_responde", label: "Não responde / Sem retorno" },
  { key: "dados_invalidos", label: "Dados inválidos (telefone/email)" },
  { key: "lead_duplicado", label: "Lead duplicado" },
  { key: "comprou_concorrente", label: "Comprou com concorrente" },
  { key: "desistiu", label: "Desistiu da compra/aluguel" },
] as const;

interface DisqualifyLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  statusId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DisqualifyLeadModal = ({
  open,
  onOpenChange,
  leadId,
  leadName,
  statusId,
  onConfirm,
  onCancel,
}: DisqualifyLeadModalProps) => {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleReason = (key: string) => {
    setSelectedReasons(prev =>
      prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
    );
  };

  const handleConfirm = async () => {
    if (selectedReasons.length === 0) return;

    setSaving(true);
    try {
      // Get account_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      // Save disqualification reasons
      const { error: reasonError } = await supabase
        .from("lead_disqualification_reasons")
        .insert({
          lead_id: leadId,
          account_id: profile.account_id,
          reasons: selectedReasons,
          notes: notes || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (reasonError) throw reasonError;

      // Update lead status
      const { error: statusError } = await supabase
        .from("leads")
        .update({ status_id: statusId })
        .eq("id", leadId);

      if (statusError) throw statusError;

      // Log disqualification activity
      const reasonLabels = selectedReasons
        .map(key => DISQUALIFICATION_REASONS.find(r => r.key === key)?.label)
        .filter(Boolean)
        .join(", ");

      const { error: activityError } = await supabase
        .from("lead_activities")
        .insert({
          lead_id: leadId,
          account_id: profile.account_id,
          activity_type: "disqualified",
          description: `Motivos: ${reasonLabels}${notes ? `. Obs: ${notes}` : ""}`,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (activityError) console.error("Activity log error:", activityError);

      toast({
        title: "Lead desqualificado",
        description: "O motivo foi registrado com sucesso.",
      });

      // Reset state
      setSelectedReasons([]);
      setNotes("");
      onConfirm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao desqualificar lead",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedReasons([]);
    setNotes("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Desqualificar Lead
          </DialogTitle>
          <DialogDescription>
            Por que <strong>{leadName}</strong> está sendo desqualificado? Selecione pelo menos um motivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            {DISQUALIFICATION_REASONS.map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-3">
                <Checkbox
                  id={key}
                  checked={selectedReasons.includes(key)}
                  onCheckedChange={() => toggleReason(key)}
                />
                <Label htmlFor={key} className="text-sm cursor-pointer font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="disqualify-notes" className="text-sm text-muted-foreground">
              Observações adicionais (opcional)
            </Label>
            <Textarea
              id="disqualify-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre a desqualificação..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={selectedReasons.length === 0 || saving}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            {saving ? "Salvando..." : "Confirmar Desqualificação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { DISQUALIFICATION_REASONS };
export default DisqualifyLeadModal;
