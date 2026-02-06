import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComparisonBadge } from "@/components/ui/comparison-badge";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Line, Legend, ComposedChart, Area } from "recharts";
import { Building2, Megaphone } from "lucide-react";

interface OverviewData {
  leadStats: {
    periodTotal: number;
    periodHotLeads: number;
    periodWarmLeads: number;
    periodColdLeads: number;
    byTemperature: { name: string; count: number; color: string }[];
    byCampaign: { name: string; count: number }[];
    dailyCreated: { date: string; count: number }[];
  };
  adStats: {
    totalSpend: number;
    totalLeads: number;
    avgCPL: number;
    dailyData: { date: string; spend: number; leads: number }[];
    campaignData: { name: string; spend: number; leads: number; cpl: number }[];
  };
  propertyStats: {
    id: string;
    title: string;
    leadCount: number;
    hotLeads: number;
    campaignCost: number;
    cpl: number;
  }[];
  previousPeriod?: {
    leads: number;
    spend: number;
    hotLeads: number;
  };
}

interface ReportsOverviewTabProps {
  data: OverviewData;
  period: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ReportsOverviewTab({ data, period }: ReportsOverviewTabProps) {
  const { leadStats, adStats, propertyStats, previousPeriod } = data;

  // Prepare combined daily data for leads vs spend
  const combinedDailyData = leadStats.dailyCreated.map((day, index) => ({
    date: day.date,
    leads: day.count,
    spend: adStats.dailyData[index]?.spend || 0,
  }));

  // Top 5 campaigns
  const topCampaigns = [...leadStats.byCampaign]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top 5 properties
  const topProperties = [...propertyStats]
    .sort((a, b) => b.leadCount - a.leadCount)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary cards with comparisons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total de Leads
              {previousPeriod && previousPeriod.leads > 0 && (
                <ComparisonBadge 
                  value={leadStats.periodTotal} 
                  previousValue={previousPeriod.leads} 
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{leadStats.periodTotal}</div>
            <p className="text-xs text-muted-foreground">
              no período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Leads Quentes
              {previousPeriod && previousPeriod.hotLeads > 0 && (
                <ComparisonBadge 
                  value={leadStats.periodHotLeads} 
                  previousValue={previousPeriod.hotLeads} 
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{leadStats.periodHotLeads}</div>
            <p className="text-xs text-muted-foreground">
              {leadStats.periodTotal > 0 
                ? ((leadStats.periodHotLeads / leadStats.periodTotal) * 100).toFixed(0)
                : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Investimento
              {previousPeriod && previousPeriod.spend > 0 && (
                <ComparisonBadge 
                  value={adStats.totalSpend} 
                  previousValue={previousPeriod.spend} 
                  invertColors 
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(adStats.totalSpend)}</div>
            <p className="text-xs text-muted-foreground">
              Meta Ads no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(adStats.avgCPL)}</div>
            <p className="text-xs text-muted-foreground">
              custo por lead
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily evolution: Leads vs Spend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Evolução Diária</CardTitle>
            <CardDescription>Leads gerados vs Investimento em anúncios</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={combinedDailyData}>
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
                    if (name === 'spend') return [formatCurrency(value), 'Investimento'];
                    return [value, 'Leads'];
                  }}
                />
                <Legend />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="spend"
                  fill="hsl(var(--primary) / 0.2)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Investimento"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="leads"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Leads"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Temperature pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Temperatura</CardTitle>
            <CardDescription>Qualificação dos leads no período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={leadStats.byTemperature}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {leadStats.byTemperature.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-sm">Quentes ({leadStats.periodHotLeads})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-sm">Mornos ({leadStats.periodWarmLeads})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm">Frios ({leadStats.periodColdLeads})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Top 5 Campanhas
            </CardTitle>
            <CardDescription>Campanhas que mais geraram leads</CardDescription>
          </CardHeader>
          <CardContent>
            {topCampaigns.length > 0 ? (
              <div className="space-y-4">
                {topCampaigns.map((campaign, index) => (
                  <div key={campaign.name} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{campaign.name}</p>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {campaign.count} leads
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma campanha no período
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Top 5 Imóveis por Performance
          </CardTitle>
          <CardDescription>Imóveis que mais geraram leads no período</CardDescription>
        </CardHeader>
        <CardContent>
          {topProperties.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-5">
              {topProperties.map((property, index) => (
                <div 
                  key={property.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}º
                    </div>
                    <span className="text-xs font-medium truncate flex-1">{property.title}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{property.leadCount}</p>
                      <p className="text-[10px] text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{property.hotLeads}</p>
                      <p className="text-[10px] text-muted-foreground">Quentes</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t text-center">
                    <p className="text-sm font-semibold text-primary">{formatCurrency(property.cpl)}</p>
                    <p className="text-[10px] text-muted-foreground">CPL</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum imóvel com leads no período
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
