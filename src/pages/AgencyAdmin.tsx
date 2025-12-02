import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/use-super-admin";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Target, Home, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccountData {
  id: string;
  name: string;
  company_name: string | null;
  created_at: string;
  user_count: number;
  lead_count: number;
  property_count: number;
  last_lead_at: string | null;
  last_activity_at: string | null;
  days_since_activity: number;
  status: 'active' | 'inactive' | 'dormant';
}

interface AgencyData {
  accounts: AccountData[];
  totals: {
    total_accounts: number;
    total_leads: number;
    total_users: number;
    total_properties: number;
    active_accounts: number;
    inactive_accounts: number;
    dormant_accounts: number;
  };
}

const AgencyAdmin = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [data, setData] = useState<AgencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!superAdminLoading && !isSuperAdmin) {
      navigate('/dashboard');
    }
  }, [isSuperAdmin, superAdminLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.access_token || !isSuperAdmin) return;

      try {
        setLoading(true);
        const { data: responseData, error: fnError } = await supabase.functions.invoke('agency-admin-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (fnError) throw fnError;
        setData(responseData);
      } catch (err: any) {
        console.error('Error fetching agency data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isSuperAdmin && session) {
      fetchData();
    }
  }, [isSuperAdmin, session]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">🟢 Ativa</Badge>;
      case 'inactive':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">🟡 Inativa</Badge>;
      case 'dormant':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔴 Parada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Nunca';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  if (superAdminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/20 rounded-xl">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Painel da Agência</h1>
          <p className="text-muted-foreground">Monitoramento de todas as contas do CRM</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.total_accounts}</p>
                <p className="text-xs text-muted-foreground">Contas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.total_leads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.total_users}</p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Home className="h-5 w-5 text-orange-400" />
              <div>
                <p className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.total_properties}</p>
                <p className="text-xs text-muted-foreground">Imóveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.active_accounts}</p>
                <p className="text-xs text-green-400/70">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-yellow-400">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.inactive_accounts}</p>
                <p className="text-xs text-yellow-400/70">Inativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.dormant_accounts}</p>
                <p className="text-xs text-red-400/70">Paradas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Todas as Contas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-red-400">
              Erro ao carregar dados: {error}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Nome / Empresa</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Imóveis</TableHead>
                    <TableHead>Último Lead</TableHead>
                    <TableHead>Última Atividade</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.accounts.map((account) => (
                    <TableRow key={account.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.company_name || account.name}</p>
                          {account.company_name && account.company_name !== account.name && (
                            <p className="text-xs text-muted-foreground">{account.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{account.user_count}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-blue-400">{account.lead_count}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-orange-400">{account.property_count}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.last_lead_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.last_activity_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(account.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyAdmin;
