import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "@/hooks/use-account";
import { toast } from "@/hooks/use-toast";

const WhiteLabelSettings = () => {
  const { user } = useAuth();
  const { account, refetchAccount } = useAccount();
  const [uploading, setUploading] = useState(false);
  const [companyName, setCompanyName] = useState(account?.company_name || "");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !account) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione um arquivo de imagem válido.",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A imagem deve ter no máximo 2MB.",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${account.id}/logo.${fileExt}`;

      // Delete old logo if exists
      if (account.logo_url) {
        const oldPath = account.logo_url.split('/logos/')[1];
        if (oldPath) {
          await supabase.storage.from('logos').remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Update account with new logo URL
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ logo_url: publicUrl })
        .eq('id', account.id);

      if (updateError) throw updateError;

      await refetchAccount();

      toast({
        title: "Sucesso!",
        description: "Logo atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Erro ao fazer upload",
        description: error.message,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!account || !account.logo_url) return;

    setUploading(true);

    try {
      // Remove from storage
      const path = account.logo_url.split('/logos/')[1];
      if (path) {
        await supabase.storage.from('logos').remove([path]);
      }

      // Update account
      const { error } = await supabase
        .from('accounts')
        .update({ logo_url: null })
        .eq('id', account.id);

      if (error) throw error;

      await refetchAccount();

      toast({
        title: "Logo removida",
        description: "A logo foi removida com sucesso.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCompanyName = async () => {
    if (!account) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ company_name: companyName })
        .eq('id', account.id);

      if (error) throw error;

      await refetchAccount();

      toast({
        title: "Sucesso!",
        description: "Nome da empresa atualizado.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            White Label
          </CardTitle>
          <CardDescription>
            Personalize o sistema com a identidade visual da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company_name">Nome da Empresa</Label>
            <div className="flex gap-2">
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da sua empresa"
              />
              <Button 
                onClick={handleSaveCompanyName} 
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-4">
            <Label>Logo da Empresa</Label>
            
            <div className="flex items-start gap-6">
              {/* Preview */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center overflow-hidden bg-muted/50">
                  {account?.logo_url ? (
                    <img
                      src={account.logo_url}
                      alt="Logo da empresa"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-12 w-12 text-muted-foreground/50" />
                  )}
                </div>
              </div>

              {/* Upload controls */}
              <div className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Faça upload da logo da sua empresa. A imagem será exibida no menu lateral do sistema.
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB. Recomendado: 200x50px
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Enviando..." : "Fazer Upload"}
                  </Button>
                  
                  {account?.logo_url && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveLogo}
                      disabled={uploading}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhiteLabelSettings;
