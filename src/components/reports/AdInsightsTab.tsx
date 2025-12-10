import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { DollarSign, Eye, MousePointer, Users, TrendingUp, Target, Megaphone, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
}

interface AdInsightsTabProps {
  adStats: AdStats;
  period: string;
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

const AdInsightsTab = ({ adStats, period }: AdInsightsTabProps) => {
  const hasData = adStats.totalSpend > 0 || adStats.totalLeads > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum dado de anúncios</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Configure a integração com Meta Ads para visualizar métricas de campanhas, gastos e performance de anúncios.
          </p>
          <Link to="/settings">
            <Button variant="outline">
              Configurar Integração Meta
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Anúncios */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(adStats.totalSpend)}</div>
            <p className="text-xs text-muted-foreground">nos últimos {period} dias</p>
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
                    if (name === 'spend') return [formatCurrency(value), 'Gasto'];
                    if (name === 'leads') return [value, 'Leads'];
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
                <BarChart data={adStats.campaignData} layout="vertical">
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
                        <span className={campaign.cpl > adStats.avgCPL ? 'text-destructive' : 'text-green-600'}>
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
    </div>
  );
};

export default AdInsightsTab;
