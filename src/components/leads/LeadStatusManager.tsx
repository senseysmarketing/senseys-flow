import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit2, Trash2, Move } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  is_system: boolean;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#64748b", "#374151", "#111827",
];

const LeadStatusManager = () => {
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [statusForm, setStatusForm] = useState({ name: "", color: "#5a5f65" });

  useEffect(() => {
    fetchLeadStatuses();
  }, []);

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_status")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      setLeadStatuses(data || []);
    } catch (error) {
      console.error("Erro ao buscar status:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os status dos leads." });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.name.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome do status é obrigatório." });
      return;
    }
    try {
      if (editingStatus) {
        const { error } = await supabase.from("lead_status").update({ name: statusForm.name, color: statusForm.color }).eq("id", editingStatus.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Status atualizado com sucesso!" });
      } else {
        const maxPosition = Math.max(...leadStatuses.map(s => s.position), -1);
        const { data: accountData, error: accountError } = await supabase.rpc('get_user_account_id');
        if (accountError) throw accountError;
        const { error } = await supabase.from("lead_status").insert([{
          name: statusForm.name,
          color: statusForm.color,
          position: maxPosition + 1,
          is_default: false,
          account_id: accountData,
        }]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Status criado com sucesso!" });
      }
      setIsDialogOpen(false);
      setEditingStatus(null);
      setStatusForm({ name: "", color: "#5a5f65" });
      fetchLeadStatuses();
    } catch (error) {
      console.error("Erro ao salvar status:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar o status." });
    }
  };

  const handleDelete = async (statusId: string) => {
    try {
      const { error } = await supabase.from("lead_status").delete().eq("id", statusId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Status removido com sucesso!" });
      fetchLeadStatuses();
    } catch (error) {
      console.error("Erro ao remover status:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível remover o status." });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const items = Array.from(leadStatuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updatedItems = items.map((item, index) => ({ ...item, position: index }));
    setLeadStatuses(updatedItems);

    try {
      await Promise.all(updatedItems.map(item =>
        supabase.from("lead_status").update({ position: item.position }).eq("id", item.id)
      ));
      toast({ title: "Sucesso", description: "Ordem dos status atualizada!" });
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar a ordem." });
      fetchLeadStatuses();
    }
  };

  const openEdit = (status: LeadStatus) => {
    setEditingStatus(status);
    setStatusForm({ name: status.name, color: status.color });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingStatus(null);
    setStatusForm({ name: "", color: "#5a5f65" });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Arraste para reordenar o funil de vendas
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo Status
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="statuses">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {leadStatuses.map((status, index) => (
                <Draggable key={status.id} draggableId={status.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div {...provided.dragHandleProps}>
                        <Move className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </div>
                      <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                      <span className="flex-1 font-medium text-sm">{status.name}</span>
                      {status.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                      {!status.is_system && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(status)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover status?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Leads com este status serão mantidos, mas o status será removido da lista.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(status.id)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStatus ? "Editar Status" : "Novo Status"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={statusForm.name}
                onChange={(e) => setStatusForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Em negociação"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setStatusForm(prev => ({ ...prev, color }))}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${statusForm.color === color ? "border-primary scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingStatus ? "Salvar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadStatusManager;
