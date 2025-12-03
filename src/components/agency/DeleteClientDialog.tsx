import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";

interface AccountData {
  id: string;
  name: string;
  company_name: string | null;
}

interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accessToken: string;
  account: AccountData | null;
}

export const DeleteClientDialog = ({ open, onOpenChange, onSuccess, accessToken, account }: DeleteClientDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const handleDelete = async () => {
    if (!account) return;
    
    if (confirmation !== "EXCLUIR") {
      toast({
        variant: "destructive",
        title: "Confirmação necessária",
        description: 'Digite "EXCLUIR" para confirmar'
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-client-account', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          account_id: account.id,
          confirmation: "EXCLUIR"
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Conta excluída",
        description: "A conta e todos os dados foram removidos"
      });

      setConfirmation("");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const accountName = account?.company_name || account?.name || "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Conta
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a excluir permanentemente a conta <strong className="text-foreground">{accountName}</strong>.
            </p>
            <p className="text-destructive font-medium">
              Esta ação é IRREVERSÍVEL e irá excluir:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li>Todos os leads e atividades</li>
              <li>Todos os imóveis</li>
              <li>Todos os eventos</li>
              <li>Todos os usuários da conta</li>
              <li>Todas as configurações</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2 py-4">
          <Label htmlFor="confirmation" className="text-sm">
            Digite <span className="font-mono bg-muted px-1 rounded">EXCLUIR</span> para confirmar:
          </Label>
          <Input
            id="confirmation"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            placeholder="EXCLUIR"
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setConfirmation("");
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isLoading || confirmation !== "EXCLUIR"}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Excluindo...
              </>
            ) : (
              "Excluir Permanentemente"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
