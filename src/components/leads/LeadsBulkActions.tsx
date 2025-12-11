import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, ChevronDown, Trash, Download, UserPlus } from "lucide-react";
import BrokerSelect from "@/components/BrokerSelect";

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

interface LeadsBulkActionsProps {
  selectedCount: number;
  statuses: LeadStatus[];
  onClearSelection: () => void;
  onBulkStatusChange: (statusId: string) => void;
  onBulkAssign: (brokerId: string) => void;
  onBulkDelete: () => void;
  onExportSelected: () => void;
  canAssign: boolean;
}

const LeadsBulkActions = ({
  selectedCount,
  statuses,
  onClearSelection,
  onBulkStatusChange,
  onBulkAssign,
  onBulkDelete,
  onExportSelected,
  canAssign,
}: LeadsBulkActionsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const handleAssign = () => {
    if (selectedBroker) {
      onBulkAssign(selectedBroker);
      setShowAssignDialog(false);
      setSelectedBroker(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg animate-in">
        <Badge variant="secondary" className="h-7 px-3">
          {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
        </Badge>

        <div className="flex items-center gap-2 flex-1">
          {/* Alterar Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Alterar Status
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {statuses.map((status) => (
                <DropdownMenuItem
                  key={status.id}
                  onClick={() => onBulkStatusChange(status.id)}
                  className="flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Atribuir Corretor */}
          {canAssign && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowAssignDialog(true)}
            >
              <UserPlus className="h-4 w-4" />
              Atribuir
            </Button>
          )}

          {/* Exportar */}
          <Button variant="outline" size="sm" className="gap-2" onClick={onExportSelected}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>

          <DropdownMenuSeparator className="h-6 w-px bg-border" />

          {/* Deletar */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash className="h-4 w-4" />
            Deletar
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar {selectedCount} lead{selectedCount > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os leads selecionados serão permanentemente removidos
              do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onBulkDelete();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Broker Dialog */}
      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atribuir Corretor</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o corretor para atribuir aos {selectedCount} lead{selectedCount > 1 ? "s" : ""}{" "}
              selecionado{selectedCount > 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <BrokerSelect
              value={selectedBroker}
              onValueChange={setSelectedBroker}
              placeholder="Selecionar corretor"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedBroker(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssign} disabled={!selectedBroker}>
              Atribuir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LeadsBulkActions;
