import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Loader2, Building2, FileText } from "lucide-react";

interface MetaClientConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  accountId: string | null;
  existingConfig: {
    ad_account_id: string;
    ad_account_name: string | null;
    page_id: string | null;
    page_name: string | null;
    form_id: string | null;
    form_name: string | null;
    is_active: boolean;
  } | null;
  onSuccess: () => void;
}

interface AdAccount {
  id: string;
  fullId: string;
  name: string;
  status: number;
  currency: string;
  business: string;
}

interface Page {
  id: string;
  name: string;
  category: string;
}

interface Form {
  id: string;
  name: string;
  status: string;
}

export function MetaClientConfigModal({
  open,
  onOpenChange,
  accessToken,
  accountId,
  existingConfig,
  onSuccess,
}: MetaClientConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>("");
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [selectedForm, setSelectedForm] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  
  const [loadingAdAccounts, setLoadingAdAccounts] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAdAccounts();
      fetchPages();
      
      // Set existing values
      if (existingConfig) {
        setSelectedAdAccount(existingConfig.ad_account_id || "");
        setSelectedPage(existingConfig.page_id || "");
        setSelectedForm(existingConfig.form_id || "");
        setIsActive(existingConfig.is_active);
      } else {
        setSelectedAdAccount("");
        setSelectedPage("");
        setSelectedForm("");
        setIsActive(true);
      }
    }
  }, [open, existingConfig]);

  // Fetch forms when page changes
  useEffect(() => {
    if (selectedPage) {
      fetchForms(selectedPage);
    } else {
      setForms([]);
      setSelectedForm("");
    }
  }, [selectedPage]);

  const fetchAdAccounts = async () => {
    setLoadingAdAccounts(true);
    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-accounts?action=ad-accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setAdAccounts(data.adAccounts || []);
    } catch (err) {
      console.error('Error fetching ad accounts:', err);
    } finally {
      setLoadingAdAccounts(false);
    }
  };

  const fetchPages = async () => {
    setLoadingPages(true);
    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-accounts?action=pages`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setPages(data.pages || []);
    } catch (err) {
      console.error('Error fetching pages:', err);
    } finally {
      setLoadingPages(false);
    }
  };

  const fetchForms = async (pageId: string) => {
    setLoadingForms(true);
    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-accounts?action=forms&page_id=${pageId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setForms(data.forms || []);
    } catch (err) {
      console.error('Error fetching forms:', err);
    } finally {
      setLoadingForms(false);
    }
  };

  const handleSave = async () => {
    if (!accountId || !selectedAdAccount) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione uma conta de anúncios",
      });
      return;
    }

    setSaving(true);
    try {
      const selectedAdAccountData = adAccounts.find(a => a.id === selectedAdAccount);
      const selectedPageData = pages.find(p => p.id === selectedPage);
      const selectedFormData = forms.find(f => f.id === selectedForm);

      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-accounts?action=save-config`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_id: accountId,
            ad_account_id: selectedAdAccount,
            ad_account_name: selectedAdAccountData?.name || null,
            page_id: selectedPage || null,
            page_name: selectedPageData?.name || null,
            form_id: selectedForm || null,
            form_name: selectedFormData?.name || null,
            is_active: isActive,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Configuração salva",
        description: "As configurações Meta foram atualizadas",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Configurar Meta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Ad Account Select */}
          <div className="space-y-2">
            <Label>Conta de Anúncios *</Label>
            {loadingAdAccounts ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col">
                        <span>{account.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.business} • {account.currency}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Page Select */}
          <div className="space-y-2">
            <Label>Página do Facebook</Label>
            {loadingPages ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedPage} onValueChange={setSelectedPage}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma página (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      <div className="flex flex-col">
                        <span>{page.name}</span>
                        <span className="text-xs text-muted-foreground">{page.category}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Selecione para receber leads automaticamente desta página
            </p>
          </div>

          {/* Form Select (only if page is selected) */}
          {selectedPage && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Formulário de Leads
              </Label>
              {loadingForms ? (
                <Skeleton className="h-10 w-full" />
              ) : forms.length > 0 ? (
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um formulário (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os formulários</SelectItem>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum formulário encontrado nesta página
                </p>
              )}
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <Label>Integração Ativa</Label>
              <p className="text-xs text-muted-foreground">
                Desative para pausar o recebimento de leads
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedAdAccount}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
