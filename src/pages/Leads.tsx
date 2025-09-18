import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  Phone,
  Mail,
  MessageCircle,
  Eye,
  Edit,
  Trash,
  Grid,
  List
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interesse?: string;
  observacoes?: string;
  origem?: string;
  campanha?: string;
  conjunto?: string;
  anuncio?: string;
  created_at: string;
  updated_at: string;
  status_id?: string;
  lead_status?: {
    name: string;
    color: string;
  };
}

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  position: number;
}

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    interesse: "",
    observacoes: "",
    origem: "",
    campanha: "",
    conjunto: "",
    anuncio: "",
    status_id: ""
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch statuses
      const { data: statusData, error: statusError } = await supabase
        .from('lead_status')
        .select('*')
        .order('position');

      if (statusError) throw statusError;
      setStatuses(statusData || []);

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          *,
          lead_status (
            name,
            color
          )
        `)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newLead.name || !newLead.phone) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
      });
      return;
    }

    setLoading(true);

    try {
      // Get user's account_id from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Use the first status if no status selected
      const statusId = newLead.status_id || (statuses.length > 0 ? statuses[0].id : null);

      const { error } = await supabase
        .from('leads')
        .insert([{
          ...newLead,
          status_id: statusId,
          account_id: profile.account_id
        }]);

      if (error) throw error;

      toast({
        title: "Lead criado com sucesso!",
        description: "O lead foi adicionado ao sistema.",
      });

      setIsDialogOpen(false);
      setNewLead({
        name: "",
        phone: "",
        email: "",
        interesse: "",
        observacoes: "",
        origem: "",
        campanha: "",
        conjunto: "",
        anuncio: "",
        status_id: ""
      });

      fetchData();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar lead",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const openWhatsApp = (phone: string, name: string) => {
    const message = `Olá ${name}! Aqui é da Senseys - Marketing Imobiliário. Como posso te ajudar?`;
    const whatsappUrl = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm) ||
    (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getLeadsByStatus = (statusId: string) => {
    return filteredLeads.filter(lead => lead.status_id === statusId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Leads</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e acompanhe o funil de vendas
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Lead</DialogTitle>
                <DialogDescription>
                  Preencha as informações do lead. Nome e telefone são obrigatórios.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={newLead.name}
                      onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newLead.status_id}
                      onValueChange={(value) => setNewLead({...newLead, status_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interesse">Interesse</Label>
                  <Input
                    id="interesse"
                    value={newLead.interesse}
                    onChange={(e) => setNewLead({...newLead, interesse: e.target.value})}
                    placeholder="Ex: Apartamento 2 quartos, Casa em condomínio..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="origem">Origem</Label>
                    <Input
                      id="origem"
                      value={newLead.origem}
                      onChange={(e) => setNewLead({...newLead, origem: e.target.value})}
                      placeholder="Ex: Facebook, Google, Indicação..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campanha">Campanha</Label>
                    <Input
                      id="campanha"
                      value={newLead.campanha}
                      onChange={(e) => setNewLead({...newLead, campanha: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={newLead.observacoes}
                    onChange={(e) => setNewLead({...newLead, observacoes: e.target.value})}
                    placeholder="Informações adicionais sobre o lead..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Criando..." : "Criar Lead"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="gap-2"
          >
            <Grid className="h-4 w-4" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        // Kanban View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {statuses.map((status) => {
            const statusLeads = getLeadsByStatus(status.id);
            return (
              <div key={status.id} className="kanban-column">
                <div className="flex items-center gap-2 mb-4">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: status.color }}
                  />
                  <h3 className="font-semibold">{status.name}</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {statusLeads.length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {statusLeads.map((lead) => (
                    <div key={lead.id} className="lead-card">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{lead.name}</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {formatPhone(lead.phone)}
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </div>
                        )}
                        {lead.origem && (
                          <div className="text-xs">
                            Origem: {lead.origem}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 h-7 text-xs gap-1"
                          onClick={() => openWhatsApp(lead.phone, lead.name)}
                        >
                          <MessageCircle className="h-3 w-3" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Table View
        <Card>
          <CardHeader>
            <CardTitle>Lista de Leads</CardTitle>
            <CardDescription>
              {filteredLeads.length} lead(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum lead encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLeads.map((lead) => (
                  <div 
                    key={lead.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <h4 className="font-medium">{lead.name}</h4>
                        <p className="text-sm text-muted-foreground">{formatPhone(lead.phone)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm">{lead.email || '-'}</p>
                        <p className="text-sm text-muted-foreground">{lead.origem || '-'}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm">{lead.interesse || '-'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {lead.lead_status && (
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: lead.lead_status.color,
                              color: lead.lead_status.color 
                            }}
                          >
                            {lead.lead_status.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openWhatsApp(lead.phone, lead.name)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Leads;