import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Webhook, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface Property {
  id: string;
  title: string;
  type: string;
  city: string | null;
}

export function WebhookSettings() {
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAccountId();
      fetchProperties();
    }
  }, [user]);

  const fetchAccountId = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      setAccountId(data.account_id);
    } catch (error) {
      console.error("Erro ao buscar account_id:", error);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, type, city")
        .order("title");
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
    }
  };

  const webhookUrl = `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/webhook-leads?account_id=${accountId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Configuração do Webhook
        </CardTitle>
        <CardDescription>
          Receba leads automaticamente através de integrações externas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL do Webhook */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">URL do Webhook</Label>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2000);
                toast({ title: "Copiado!", description: "URL do webhook copiada para a área de transferência" });
              }}
            >
              {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Método */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Método HTTP</Label>
          <Badge variant="secondary" className="font-mono">POST</Badge>
        </div>

        {/* Exemplo de Payload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Exemplo de Payload (JSON)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const payload = JSON.stringify({
                  name: "João Silva",
                  phone: "11999999999",
                  email: "joao@email.com",
                  interesse: "Apartamento 3 quartos",
                  origem: "Site",
                  campanha: "Campanha Verão",
                  anuncio: "Anúncio Principal",
                  property_id: "uuid-do-imovel (opcional)"
                }, null, 2);
                navigator.clipboard.writeText(payload);
                setCopiedPayload(true);
                setTimeout(() => setCopiedPayload(false), 2000);
                toast({ title: "Copiado!", description: "Exemplo de payload copiado" });
              }}
            >
              {copiedPayload ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Copiar
            </Button>
          </div>
          <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto">
{`{
  "name": "João Silva",
  "phone": "11999999999",
  "email": "joao@email.com",
  "interesse": "Apartamento 3 quartos",
  "origem": "Site",
  "campanha": "Campanha Verão",
  "anuncio": "Anúncio Principal",
  "property_id": "uuid-do-imovel (opcional)"
}`}
          </pre>
        </div>

        {/* Campos Obrigatórios */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Campos Obrigatórios</Label>
          <div className="flex flex-wrap gap-2">
            <Badge>name</Badge>
            <Badge>phone</Badge>
          </div>
        </div>

        {/* Lista de Imóveis */}
        {properties.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">IDs dos Imóveis Disponíveis</Label>
            <p className="text-sm text-muted-foreground">
              Use o campo <code className="bg-muted px-1 rounded">property_id</code> para vincular o lead a um imóvel específico
            </p>
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Imóvel</th>
                    <th className="text-left p-2">ID</th>
                    <th className="w-10 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map(property => (
                    <tr key={property.id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{property.title}</div>
                        <div className="text-xs text-muted-foreground">{property.type} • {property.city}</div>
                      </td>
                      <td className="p-2 font-mono text-xs">{property.id.slice(0, 8)}...</td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(property.id);
                            setCopiedPropertyId(property.id);
                            setTimeout(() => setCopiedPropertyId(null), 2000);
                            toast({ title: "ID copiado!", description: `ID do imóvel "${property.title}" copiado` });
                          }}
                        >
                          {copiedPropertyId === property.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Teste */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-base font-semibold">Testar Webhook</Label>
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para enviar um lead de teste
          </p>
          <Button
            variant="outline"
            disabled={testingWebhook || !accountId}
            onClick={async () => {
              setTestingWebhook(true);
              try {
                const response = await fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: "Lead de Teste",
                    phone: "11999999999",
                    email: "teste@webhook.com",
                    interesse: "Teste de integração",
                    origem: "Webhook Test"
                  })
                });
                if (response.ok) {
                  toast({ title: "✅ Teste enviado!", description: "Lead de teste criado com sucesso. Verifique na página de Leads." });
                } else {
                  throw new Error('Falha no teste');
                }
              } catch {
                toast({ variant: "destructive", title: "Erro no teste", description: "Não foi possível enviar o lead de teste" });
              } finally {
                setTestingWebhook(false);
              }
            }}
          >
            {testingWebhook ? "Enviando..." : "Enviar Lead de Teste"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
