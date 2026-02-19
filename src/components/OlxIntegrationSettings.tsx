import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check, Building2, Zap, Info, BookOpen, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OlxIntegrationSettingsProps {
  accountId: string;
}

const SUPABASE_PROJECT_ID = "ujodxlzlfvdwqufkgdnw";

const FIELD_MAPPINGS = [
  { olxField: "name", crmField: "name", description: "Nome do lead" },
  { olxField: "ddd + phone", crmField: "phone", description: "Concatenação do DDD com número" },
  { olxField: "email", crmField: "email", description: "E-mail do consumidor" },
  { olxField: "message", crmField: "observacoes", description: "Mensagem/interesse do lead" },
  { olxField: "clientListingId", crmField: "property_id ou anuncio", description: "Vincula imóvel pelo código de referência; se não encontrar, salva o código no campo Anúncio" },
  { olxField: "temperature", crmField: "temperature", description: "Alta→hot / Média→warm / Baixa→cold" },
  { olxField: "leadOrigin", crmField: "origem", description: "Sempre \"Grupo OLX\"" },
  { olxField: "transactionType", crmField: "interesse", description: "SELL→Compra / RENT→Aluguel" },
  { olxField: "extraData.leadType", crmField: "campanha", description: "Canal de origem do lead" },
  { olxField: "originLeadId", crmField: "meta_lead_id", description: "ID externo para detecção de duplicatas" },
];

const LEAD_TYPE_MAPPINGS = [
  { olxValue: "CONTACT_CHAT", crmValue: "Chat" },
  { olxValue: "CONTACT_FORM", crmValue: "Formulário" },
  { olxValue: "CLICK_WHATSAPP", crmValue: "WhatsApp" },
  { olxValue: "CLICK_SCHEDULE", crmValue: "Agendamento" },
  { olxValue: "PHONE_VIEW", crmValue: "Visualização de Telefone" },
  { olxValue: "VISIT_REQUEST", crmValue: "Solicitação de Visita" },
];

const EXAMPLE_PAYLOAD = {
  leadOrigin: "Grupo OLX",
  timestamp: "2024-01-15T10:30:00.000Z",
  originLeadId: "59ee0fc6e4b043e1b2a6d863",
  originListingId: "87027856",
  clientListingId: "a40171",
  name: "João Silva",
  email: "joao.silva@email.com",
  ddd: "11",
  phone: "999999999",
  message: "Olá, tenho interesse neste imóvel. Aguardo o contato.",
  temperature: "Alta",
  transactionType: "SELL",
  extraData: {
    leadType: "CONTACT_FORM",
  },
};

export function OlxIntegrationSettings({ accountId }: OlxIntegrationSettingsProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/olx-webhook?account_id=${accountId}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({ title: "Copiado!", description: "URL do webhook OLX copiada para a área de transferência" });
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(EXAMPLE_PAYLOAD, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
    toast({ title: "Copiado!", description: "Payload de exemplo copiado" });
  };

  const handleSimulateLead = async () => {
    setSimulating(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(EXAMPLE_PAYLOAD),
      });
      const result = await response.json();
      if (response.ok) {
        toast({
          title: "✅ Lead simulado com sucesso!",
          description: `Lead "${EXAMPLE_PAYLOAD.name}" criado via Grupo OLX. Verifique a lista de leads.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro na simulação",
          description: result.error || "Não foi possível criar o lead de teste.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na simulação",
        description: "Não foi possível conectar ao webhook.",
      });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Integração Grupo OLX</CardTitle>
                <CardDescription>
                  Receba leads automaticamente do OLX, VivaReal e ZAP Imóveis
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="border border-border">
              <span className="w-2 h-2 bg-primary rounded-full mr-1.5 inline-block" />
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              O Grupo OLX (OLX, VivaReal e ZAP Imóveis) envia leads no formato deles. Este webhook recebe o payload, normaliza os campos e cria o lead automaticamente no CRM com todas as regras de distribuição, notificações e automações WhatsApp aplicadas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            URL do Webhook
          </CardTitle>
          <CardDescription>
            Configure esta URL no painel do Grupo OLX / VivaReal / ZAP Imóveis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button variant="outline" size="icon" onClick={handleCopyUrl}>
              {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="font-mono">POST</Badge>
            <Badge variant="outline">Content-Type: application/json</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Como configurar no painel do Grupo OLX
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Acesse o painel do Grupo OLX</p>
                <p className="text-sm text-muted-foreground">Entre em <span className="font-mono bg-muted px-1 rounded">grupozap.com</span> com sua conta de anunciante e navegue até a seção de integrações ou API.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Localize a configuração de Webhook</p>
                <p className="text-sm text-muted-foreground">Procure por "Configuração de Leads" ou "Webhook de Leads" nas configurações da sua conta.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Cole a URL acima no campo de Webhook</p>
                <p className="text-sm text-muted-foreground">Insira a URL copiada no campo destinado ao endpoint de recebimento de leads.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium">Configure o código de referência dos imóveis</p>
                <p className="text-sm text-muted-foreground">
                  Para vinculação automática de imóveis, certifique-se que o campo <span className="font-mono bg-muted px-1 rounded">Código do Anunciante</span> (clientListingId) no OLX é o mesmo valor do campo <span className="font-mono bg-muted px-1 rounded">Código de Referência</span> cadastrado no imóvel no CRM.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">5</span>
              <div>
                <p className="font-medium">Teste com o botão abaixo</p>
                <p className="text-sm text-muted-foreground">Use o botão "Simular Lead" para verificar se a integração está funcionando corretamente.</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Field Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento de Campos</CardTitle>
          <CardDescription>
            Como cada campo enviado pelo Grupo OLX é mapeado no CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo OLX</TableHead>
                <TableHead>Campo no CRM</TableHead>
                <TableHead className="hidden md:table-cell">Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELD_MAPPINGS.map((mapping) => (
                <TableRow key={mapping.olxField}>
                  <TableCell>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{mapping.olxField}</code>
                  </TableCell>
                  <TableCell>
                    <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">{mapping.crmField}</code>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {mapping.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* leadType sub-mapping */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm font-medium mb-2">Mapeamento de canais (extraData.leadType → campanha)</p>
            <div className="flex flex-wrap gap-2">
              {LEAD_TYPE_MAPPINGS.map((m) => (
                <div key={m.olxValue} className="flex items-center gap-1.5 text-xs">
                  <code className="bg-muted px-1.5 py-0.5 rounded">{m.olxValue}</code>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{m.crmValue}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Linking Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Vinculação Automática de Imóveis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Quando o Grupo OLX envia o campo <code className="bg-muted px-1 rounded">clientListingId</code> (código do anúncio que você cadastrou no portal), o sistema busca automaticamente um imóvel no CRM cujo <strong>Código de Referência</strong> seja igual a esse valor.
          </p>
          <div className="p-3 bg-muted/50 rounded-lg border text-sm">
            <p className="font-medium mb-1">Exemplo:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Imóvel no CRM com código de referência: <code className="bg-muted px-1 rounded">AP-001</code></li>
              <li>• Anúncio no OLX com "Código do Anunciante": <code className="bg-muted px-1 rounded">AP-001</code></li>
              <li>• Lead recebido será <strong>automaticamente vinculado</strong> ao imóvel correto ✅</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Test / Simulate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Testar Integração
          </CardTitle>
          <CardDescription>
            Envie um lead de exemplo para verificar se a integração está funcionando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Payload de exemplo (formato OLX)</Label>
              <Button variant="ghost" size="sm" onClick={handleCopyPayload}>
                {copiedPayload ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copiar
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
              {JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
            </pre>
          </div>
          <Button onClick={handleSimulateLead} disabled={simulating} className="w-full sm:w-auto">
            <Zap className="h-4 w-4 mr-2" />
            {simulating ? "Simulando..." : "Simular Lead OLX"}
          </Button>
          <p className="text-xs text-muted-foreground">
            O lead simulado será criado com origem "Grupo OLX" e temperatura "Quente" (Alta). Ele aparecerá na lista de leads e passará por todas as regras de distribuição e automações configuradas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
