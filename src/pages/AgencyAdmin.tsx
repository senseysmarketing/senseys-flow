import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/use-super-admin";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Building2, Target, Activity, Clock, Plus, Key, Pencil, Trash2, Loader2, Facebook, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateClientModal } from "@/components/agency/CreateClientModal";
import { EditClientModal } from "@/components/agency/EditClientModal";
import { DeleteClientDialog } from "@/components/agency/DeleteClientDialog";
import { MetaIntegrationSection } from "@/components/agency/MetaIntegrationSection";

interface AccountData {
  id: string;
  name: string;
  company_name: string | null;
  created_at: string;
  lead_count: number;
  whatsapp_connected: boolean;
  whatsapp_phone: string | null;
  last_message_sent_at: string | null;
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
    whatsapp_connected_count: number;
    active_accounts: number;
    inactive_accounts: number;
    dormant_accounts: number;
  };
}

const AgencyAdmin = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [data, setData] = useState<AgencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null);
  const [accessingAccount, setAccessingAccount] = useState<string | null>(null);

  useEffect(() => {
    if (!superAdminLoading && !isSuperAdmin) {
      navigate('/dashboard');
    }
  }, [isSuperAdmin, superAdminLoading, navigate]);

  const fetchData = async () => {
    if (!session?.access_token || !isSuperAdmin) return;

    try {
      setLoading(true);
      const { data: responseData, error: fnError } = await supabase.functions.invoke('agency-admin-data', {
        headers: { Authorization: `Bearer ${session.access_token}` }
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

  useEffect(() => {
    if (isSuperAdmin && session) {
      fetchData();
    }
  }, [isSuperAdmin, session]);

  const handleAccessAccount = async (account: AccountData) => {
    if (!session?.access_token) return;
    
    setAccessingAccount(account.id);
    
    try {
      // Save current agency session before generating support session
      const backupSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      };
      localStorage.setItem('agency_backup_session', JSON.stringify(backupSession));
      localStorage.setItem('support_account_name', account.company_name || account.name);
      if (session.user?.id) {
        localStorage.setItem('agency_backup_user_id', session.user.id);
      }

      const { data, error } = await supabase.functions.invoke('generate-support-session', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { 
          account_id: account.id
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      console.log('Support session data:', data);

      // Build support callback URL with token_hash and email
      const supportUrl = `${window.location.origin}/auth/support-callback?token_hash=${encodeURIComponent(data.token_hash)}&email=${encodeURIComponent(data.email)}&type=magiclink`;
      
      console.log('Opening support URL:', supportUrl);

      // Open in same tab (support mode works best this way)
      window.location.href = supportUrl;
    } catch (err: any) {
      console.error('Error generating support session:', err);
      // Clear backup if error occurs
      localStorage.removeItem('agency_backup_session');
      localStorage.removeItem('support_account_name');
      toast({
        variant: "destructive",
        title: "Erro ao acessar conta",
        description: err.message
      });
    } finally {
      setAccessingAccount(null);
    }
  };

  const handleEdit = (account: AccountData) => {
    setSelectedAccount(account);
    setShowEditModal(true);
  };

  const handleDelete = (account: AccountData) => {
    setSelectedAccount(account);
    setShowDeleteDialog(true);
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/20 rounded-xl">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Painel da Agência</h1>
            <p className="text-muted-foreground">Monitoramento de todas as contas do CRM</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList className="bg-card/50 backdrop-blur">
          <TabsTrigger value="accounts" className="gap-2">
            <Building2 className="h-4 w-4" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <Facebook className="h-4 w-4" />
            Integração Meta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <Smartphone className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">{loading ? <Skeleton className="h-8 w-12" /> : data?.totals.whatsapp_connected_count}</p>
                <p className="text-xs text-muted-foreground">WhatsApp Conectados</p>
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
                     <TableHead className="text-center">Leads</TableHead>
                     <TableHead className="text-center">WhatsApp</TableHead>
                     <TableHead>Última Msg</TableHead>
                     <TableHead>Último Lead</TableHead>
                     <TableHead className="text-center">Status</TableHead>
                     <TableHead className="text-center">Ações</TableHead>
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
                         <span className="font-medium text-blue-400">{account.lead_count}</span>
                       </TableCell>
                       <TableCell className="text-center">
                         {account.whatsapp_connected ? (
                           <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                             <Smartphone className="h-3 w-3 mr-1" />
                             Conectado
                           </Badge>
                         ) : (
                           <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                             Desconectado
                           </Badge>
                         )}
                       </TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {account.whatsapp_connected && account.last_message_sent_at
                           ? formatDate(account.last_message_sent_at)
                           : '—'}
                       </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.last_lead_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(account.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            onClick={() => handleAccessAccount(account)}
                            disabled={accessingAccount === account.id}
                            title="Acessar conta (modo suporte)"
                          >
                            {accessingAccount === account.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Key className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                            onClick={() => handleEdit(account)}
                            title="Editar conta"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleDelete(account)}
                            title="Excluir conta"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="meta">
          <MetaIntegrationSection
            accessToken={session?.access_token || ""}
            accounts={data?.accounts.map(a => ({
              id: a.id,
              name: a.name,
              company_name: a.company_name,
            })) || []}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateClientModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={fetchData}
        accessToken={session?.access_token || ""}
      />

      <EditClientModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSuccess={fetchData}
        accessToken={session?.access_token || ""}
        account={selectedAccount}
      />

      <DeleteClientDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={fetchData}
        accessToken={session?.access_token || ""}
        account={selectedAccount}
      />
    </div>
  );
};

export default AgencyAdmin;
