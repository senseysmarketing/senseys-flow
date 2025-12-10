import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Building2, Users, DollarSign, TrendingUp, Flame, Thermometer, Snowflake, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export interface PropertyStats {
  id: string;
  title: string;
  type: string;
  status: string;
  leadCount: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  campaignCost: number;
  cpl: number;
}

interface PropertyInsightsTabProps {
  propertyStats: PropertyStats[];
  period: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const TEMPERATURE_COLORS = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#3b82f6',
};

const PropertyInsightsTab = ({ propertyStats, period }: PropertyInsightsTabProps) => {
  const hasData = propertyStats.length > 0;

  // Calcular totais
  const totals = propertyStats.reduce((acc, prop) => ({
    leads: acc.leads + prop.leadCount,
    hotLeads: acc.hotLeads + prop.hotLeads,
    warmLeads: acc.warmLeads + prop.warmLeads,
    coldLeads: acc.coldLeads + prop.coldLeads,
    campaignCost: acc.campaignCost + prop.campaignCost,
  }), { leads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, campaignCost: 0 });

  const avgCPL = totals.leads > 0 ? totals.campaignCost / totals.leads : 0;

  // Dados para gráfico de pizza de temperatura
  const temperatureData = [
    { name: 'Quentes', value: totals.hotLeads, color: TEMPERATURE_COLORS.hot },
    { name: 'Mornos', value: totals.warmLeads, color: TEMPERATURE_COLORS.warm },
    { name: 'Frios', value: totals.coldLeads, color: TEMPERATURE_COLORS.cold },
  ].filter(d => d.value > 0);

  // Top 10 imóveis por leads
  const topProperties = [...propertyStats]
    .sort((a, b) => b.leadCount - a.leadCount)
    .slice(0, 10);

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum imóvel cadastrado</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Cadastre imóveis e vincule leads a eles para visualizar métricas de performance por propriedade.
          </p>
          <Link to="/properties">
            <Button variant="outline">
              Cadastrar Imóveis
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Imóveis */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Imóveis</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{propertyStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {propertyStats.filter(p => p.leadCount > 0).length} com leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads por Imóvel</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.leads}</div>
            <p className="text-xs text-muted-foreground">
              média: {(totals.leads / propertyStats.length).toFixed(1)} por imóvel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.campaignCost)}</div>
            <p className="text-xs text-muted-foreground">em campanhas de imóveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgCPL)}</div>
            <p className="text-xs text-muted-foreground">custo por lead</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Imóveis por Leads</CardTitle>
            <CardDescription>Imóveis que mais geraram leads</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProperties} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis 
                  dataKey="title" 
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
                />
                <Bar dataKey="leadCount" name="Leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temperatura dos Leads</CardTitle>
            <CardDescription>Distribuição por temperatura de todos os leads vinculados</CardDescription>
          </CardHeader>
          <CardContent>
            {temperatureData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={temperatureData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {temperatureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{totals.hotLeads}</p>
                      <p className="text-xs text-muted-foreground">Quentes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{totals.warmLeads}</p>
                      <p className="text-xs text-muted-foreground">Mornos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{totals.coldLeads}</p>
                      <p className="text-xs text-muted-foreground">Frios</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>Nenhum lead vinculado a imóveis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Imóveis */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Imóvel</CardTitle>
          <CardDescription>Métricas de leads e investimento por propriedade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Imóvel</th>
                  <th className="text-center py-3 px-4 font-medium">Tipo</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Leads</th>
                  <th className="text-right py-3 px-4 font-medium">🔥 / 🌡️ / ❄️</th>
                  <th className="text-right py-3 px-4 font-medium">Investimento</th>
                  <th className="text-right py-3 px-4 font-medium">CPL</th>
                </tr>
              </thead>
              <tbody>
                {propertyStats.slice(0, 20).map((property) => (
                  <tr key={property.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <Link to={`/properties`} className="font-medium hover:underline">
                        {property.title}
                      </Link>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge variant="outline">{property.type}</Badge>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge 
                        variant={property.status === 'disponivel' ? 'default' : 'secondary'}
                      >
                        {property.status}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4 font-medium">{property.leadCount}</td>
                    <td className="text-right py-3 px-4">
                      <span className="text-red-500">{property.hotLeads}</span>
                      {' / '}
                      <span className="text-amber-500">{property.warmLeads}</span>
                      {' / '}
                      <span className="text-blue-500">{property.coldLeads}</span>
                    </td>
                    <td className="text-right py-3 px-4">{formatCurrency(property.campaignCost)}</td>
                    <td className="text-right py-3 px-4">
                      {property.leadCount > 0 ? (
                        <span className={property.cpl > avgCPL ? 'text-destructive' : 'text-green-600'}>
                          {formatCurrency(property.cpl)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PropertyInsightsTab;
