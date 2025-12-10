import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Facebook, Link2, Unlink, RefreshCw, Settings, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetaClientConfigModal } from "./MetaClientConfigModal";

interface MetaIntegrationSectionProps {
  accessToken: string;
  accounts: Array<{
    id: string;
    name: string;
    company_name: string | null;
  }>;
}

interface MetaConfig {
  id: string;
  account_id: string;
  ad_account_id: string;
  ad_account_name: string | null;
  page_id: string | null;
  page_name: string | null;
  form_id: string | null;
  form_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  accounts: {
    id: string;
    name: string;
    company_name: string | null;
  };
}

interface MetaStatus {
  connected: boolean;
  userName?: string;
  expiresAt?: string;
  isExpired?: boolean;
}

export function MetaIntegrationSection({ accessToken, accounts }: MetaIntegrationSectionProps) {
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [configs, setConfigs] = useState<MetaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  
  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<MetaConfig | null>(null);

  useEffect(() => {
    fetchMetaStatus();
    fetchConfigs();
  }, [accessToken]);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'META_AUTH_SUCCESS') {
        toast({
          title: "Meta conectado!",
          description: `Conectado como ${event.data.userName}`,
        });
        fetchMetaStatus();
      } else if (event.data.type === 'META_AUTH_ERROR') {
        toast({
          variant: "destructive",
          title: "Erro ao conectar",
          description: event.data.error,
        });
      }
      setConnecting(false);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchMetaStatus = async () => {
    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-oauth?action=status`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const statusData = await response.json();
      
      if (statusData.error && statusData.error !== 'Meta not connected') {
        console.error('Meta status error:', statusData.error);
      }
      
      setMetaStatus(statusData.connected !== undefined ? statusData : { connected: false });
    } catch (err) {
      console.error('Error fetching Meta status:', err);
      setMetaStatus({ connected: false });
    }
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-accounts?action=get-configs`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('Error fetching configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-oauth?action=get-auth-url`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      
      if (data.authUrl) {
        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          data.authUrl,
          'meta-oauth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      } else {
        throw new Error('No auth URL received');
      }
    } catch (err: any) {
      console.error('Error connecting to Meta:', err);
      toast({
        variant: "destructive",
        title: "Erro ao conectar",
        description: err.message,
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-oauth?action=disconnect`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      setMetaStatus({ connected: false });
      toast({
        title: "Desconectado",
        description: "Conexão com Meta removida",
      });
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  const handleConfigureClient = (accountId: string) => {
    const existingConfig = configs.find(c => c.account_id === accountId);
    setSelectedAccountId(accountId);
    setSelectedConfig(existingConfig || null);
    setShowConfigModal(true);
  };

  const handleSyncInsights = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-insights?action=sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ account_id: accountId }),
        }
      );
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      toast({
        title: "Sincronização concluída",
        description: `${data.synced} dias de dados sincronizados`,
      });
      fetchConfigs();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro na sincronização",
        description: err.message,
      });
    } finally {
      setSyncing(null);
    }
  };

  const getConfigForAccount = (accountId: string) => {
    return configs.find(c => c.account_id === accountId);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Nunca';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Meta Connection Card */}
      <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Facebook className="h-6 w-6 text-blue-400" />
            </div>
            Integração Meta / Facebook
          </CardTitle>
          <CardDescription>
            Conecte sua conta Meta para receber leads automaticamente e visualizar dados de anúncios
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metaStatus === null ? (
            <Skeleton className="h-12 w-full" />
          ) : metaStatus.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <div>
                  <p className="font-medium text-green-400">Conectado</p>
                  <p className="text-sm text-muted-foreground">
                    {metaStatus.userName} • Expira {formatDate(metaStatus.expiresAt || null)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleConnect}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconectar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-red-400 hover:text-red-300">
                  <Unlink className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <p className="text-yellow-400">Meta não conectado</p>
              </div>
              <Button onClick={handleConnect} disabled={connecting} className="bg-blue-600 hover:bg-blue-700">
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Conectar ao Facebook
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Configurations */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração Meta por Cliente
          </CardTitle>
          <CardDescription>
            Configure qual conta de anúncios e página cada cliente deve usar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Conta de Anúncios</TableHead>
                  <TableHead>Página</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Sync</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const config = getConfigForAccount(account.id);
                  return (
                    <TableRow key={account.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.company_name || account.name}</p>
                          {account.company_name && (
                            <p className="text-xs text-muted-foreground">{account.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {config?.ad_account_name ? (
                          <span className="text-blue-400">{config.ad_account_name}</span>
                        ) : (
                          <span className="text-muted-foreground">Não configurado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {config?.page_name ? (
                          <span className="text-purple-400">{config.page_name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {config?.is_active ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>
                        ) : config ? (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Inativo</Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(config?.last_sync_at || null)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConfigureClient(account.id)}
                            disabled={!metaStatus?.connected}
                            title={metaStatus?.connected ? "Configurar" : "Conecte o Meta primeiro"}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          {config && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncInsights(account.id)}
                              disabled={syncing === account.id || !metaStatus?.connected}
                              title="Sincronizar insights"
                            >
                              {syncing === account.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL Info */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-base">URL do Webhook (Meta Developer)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-3 rounded-lg font-mono text-sm break-all">
            https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-webhook
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Configure esta URL no Meta Developer Console, seção Webhooks, com o campo "leadgen" inscrito.
          </p>
        </CardContent>
      </Card>

      {/* Config Modal */}
      <MetaClientConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        accessToken={accessToken}
        accountId={selectedAccountId}
        existingConfig={selectedConfig}
        onSuccess={() => {
          fetchConfigs();
          setShowConfigModal(false);
        }}
      />
    </div>
  );
}
