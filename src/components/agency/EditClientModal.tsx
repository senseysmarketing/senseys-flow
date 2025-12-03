import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Pencil } from "lucide-react";

interface AccountData {
  id: string;
  name: string;
  company_name: string | null;
}

interface EditClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accessToken: string;
  account: AccountData | null;
}

export const EditClientModal = ({ open, onOpenChange, onSuccess, accessToken, account }: EditClientModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_name: ""
  });

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        company_name: account.company_name || ""
      });
    }
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-client-account', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          account_id: account.id,
          name: formData.name,
          company_name: formData.company_name || null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Cliente atualizado!",
        description: "As informações foram salvas com sucesso"
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Error updating client:', err);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Cliente
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da conta</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome da conta"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Nome da empresa</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                className="pl-10"
                placeholder="Imobiliária XYZ"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
