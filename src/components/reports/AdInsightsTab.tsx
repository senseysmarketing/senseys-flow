import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { DollarSign, Eye, MousePointer, Target, Megaphone, RefreshCw, Clock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AdStats {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  totalReach: number;
  avgCPM: number;
  avgCPC: number;
  avgCPL: number;
  avgCTR: number;
  dailyData: { date: string; spend: number; leads: number; clicks: number }[];
  campaignData: { name: string; spend: number; leads: number; cpl: number; impressions: number }[];
  config?: {
    adAccountName: string | null;
    lastSyncAt: string | null;
    isActive: boolean;
  } | null;
}

interface AdInsightsTabProps {
  adStats: AdStats;
  dateFrom: string;
  dateTo: string;
  onRefresh: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

const AdInsightsTab = ({ adStats, dateFrom, dateTo, onRefresh }: AdInsightsTabProps) => {
  const [syncing, setSyncing] = useState(false);
  const hasData = adStats.totalSpend > 0 || adStats.totalLeads > 0;
  const isConfigured = adStats.config !== null;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Você precisa estar logado para sincronizar.",
        });
        return;
      }

      console.log(`Syncing from ${dateFrom} to ${dateTo}`);

      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-insights?action=sync&date_from=${dateFrom}&date_to=${dateTo}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      
      if (data.error) {
        if (data.code === 'NOT_CONFIGURED') {
          toast({
            variant: "destructive",
            title: "Meta não configurado",
            description: "Entre em contato com a agência para configurar sua conta de anúncios.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro ao sincronizar",
            description: data.error,
          });
        }
        return;
      }

      toast({
        title: "Sincronização concluída",
        description: `${data.synced} dias de dados atualizados.`,
      });
      
      onRefresh();
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível sincronizar os dados.",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!isConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Meta Ads não configurado</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Sua conta de anúncios Meta ainda não foi vinculada. Entre em contato com a agência para configurar a integração.
          </p>
          <Link to="/settings">
            <Button variant="outline">
              Ver Configurações
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com informações de sync */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {adStats.config?.adAccountName || "Conta Meta Ads"}
                </span>
              </div>
              {adStats.config?.lastSyncAt && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Última atualização: {formatDistanceToNow(new Date(adStats.config.lastSyncAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Dados'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum dado disponível</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Não há dados de anúncios para o período selecionado. Clique em "Sincronizar" para buscar dados do Meta.
            </p>
            <Button onClick={() => handleSync()} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs de Anúncios */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(adStats.totalSpend)}</div>
                <p className="text-xs text-muted-foreground">no período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressões</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(adStats.totalImpressions)}</div>
                <p className="text-xs text-muted-foreground">
                  CPM: {formatCurrency(adStats.avgCPM)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cliques</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(adStats.totalClicks)}</div>
                <p className="text-xs text-muted-foreground">
                  CPC: {formatCurrency(adStats.avgCPC)} | CTR: {adStats.avgCTR.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads de Anúncios</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(adStats.totalLeads)}</div>
                <p className="text-xs text-muted-foreground">
                  CPL: {formatCurrency(adStats.avgCPL)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução Diária</CardTitle>
                <CardDescription>Gasto e leads por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={adStats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Gasto (R$)') return [formatCurrency(value), 'Gasto'];
                        if (name === 'Leads') return [value, 'Leads'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="spend" 
                      name="Gasto (R$)"
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary)/0.2)"
                      strokeWidth={2}
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="leads" 
                      name="Leads"
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2)/0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance por Campanha</CardTitle>
                <CardDescription>Comparativo de campanhas</CardDescription>
              </CardHeader>
              <CardContent>
                {adStats.campaignData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={adStats.campaignData.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={150}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'spend') return [formatCurrency(value), 'Gasto'];
                          if (name === 'leads') return [value, 'Leads'];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <p>Nenhum dado de campanha disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Campanhas */}
          {adStats.campaignData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Campanha</CardTitle>
                <CardDescription>Métricas detalhadas de cada campanha</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Campanha</th>
                        <th className="text-right py-3 px-4 font-medium">Gasto</th>
                        <th className="text-right py-3 px-4 font-medium">Impressões</th>
                        <th className="text-right py-3 px-4 font-medium">Leads</th>
                        <th className="text-right py-3 px-4 font-medium">CPL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adStats.campaignData.map((campaign, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{campaign.name}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(campaign.spend)}</td>
                          <td className="text-right py-3 px-4">{formatNumber(campaign.impressions)}</td>
                          <td className="text-right py-3 px-4">
                            <Badge variant="secondary">{campaign.leads}</Badge>
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className={campaign.cpl > adStats.avgCPL && adStats.avgCPL > 0 ? 'text-destructive' : 'text-green-600'}>
                              {formatCurrency(campaign.cpl)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AdInsightsTab;
