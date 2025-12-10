import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
  List,
  Bell,
  BellOff,
  Flame,
  Thermometer,
  Snowflake
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useLeadNotifications } from "@/hooks/use-lead-notifications";
import { usePermissions } from "@/hooks/use-permissions";
import WhatsAppMessagePopover from "@/components/WhatsAppMessagePopover";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import LeadDetailModal from "@/components/LeadDetailModal";
import BrokerSelect from "@/components/BrokerSelect";
import PropertySelect from "@/components/PropertySelect";

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
  temperature?: string | null;
  assigned_broker_id?: string | null;
  property_id?: string | null;
  lead_status?: {
    name: string;
    color: string;
  };
  properties?: {
    id: string;
    title: string;
  } | null;
}

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  is_system?: boolean;
}

const Leads = () => {
  const { user } = useAuth();
  const { hasPermission, isOwner } = usePermissions();
  const canAssignLeads = hasPermission('leads.assign') || isOwner;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    origem: "",
    startDate: "",
    endDate: ""
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('lead-notifications-enabled') !== 'false'
  );

  // Ativar notificações de novos leads (apenas se habilitado)
  useLeadNotifications(notificationsEnabled ? () => {
    // Recarregar dados quando um novo lead for adicionado
    fetchData();
  } : undefined, notificationsEnabled);

  // Função para alternar notificações
  const toggleNotifications = () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    localStorage.setItem('lead-notifications-enabled', newState.toString());
    
    toast({
      title: newState ? "🔔 Notificações Ativadas" : "🔕 Notificações Desativadas",
      description: newState 
        ? "Você receberá sons e alertas quando novos leads forem adicionados" 
        : "Não receberá mais notificações sonoras de novos leads",
    });
  };
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
    status_id: "",
    temperature: "warm" as 'hot' | 'warm' | 'cold',
    assigned_broker_id: null as string | null,
    property_id: null as string | null
  });
  
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Debug: Check current session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session user:', session?.user?.id);
      
      // Debug: Check profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .single();
      
      console.log('User profile account_id:', profile?.account_id, 'Error:', profileError);

      // Fetch statuses
      const { data: statusData, error: statusError } = await supabase
        .from('lead_status')
        .select('*')
        .order('position');

      if (statusError) {
        console.error('Status fetch error:', statusError);
        throw statusError;
      }
      setStatuses(statusData || []);

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          *,
          lead_status (
            name,
            color
          ),
          properties (
            id,
            title
          )
        `)
        .order('created_at', { ascending: false });

      console.log('Leads fetch result:', { count: leadsData?.length, error: leadsError });
      
      if (leadsError) {
        console.error('Leads fetch error:', leadsError);
        throw leadsError;
      }

      // Atribuir status padrão para leads sem status_id
      const defaultStatus = statusData?.find(s => s.is_default) || statusData?.[0];
      const leadsWithoutStatus = leadsData?.filter(l => !l.status_id) || [];
      
      console.log('Leads sem status:', leadsWithoutStatus.length);
      console.log('Status padrão:', defaultStatus);

      // Atualizar leads sem status no banco de dados
      if (leadsWithoutStatus.length > 0 && defaultStatus) {
        const updatePromises = leadsWithoutStatus.map(lead =>
          supabase
            .from('leads')
            .update({ status_id: defaultStatus.id })
            .eq('id', lead.id)
        );
        
        await Promise.all(updatePromises);
        console.log('Leads atualizadas com status padrão:', leadsWithoutStatus.length);
      }

      const leadsWithStatus = leadsData?.map(lead => ({
        ...lead,
        status_id: lead.status_id || defaultStatus?.id
      })) || [];

      setLeads(leadsWithStatus);

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
        status_id: "",
        temperature: "warm",
        assigned_broker_id: null,
        property_id: null
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

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setIsEditDialogOpen(true);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingLead?.name || !editingLead?.phone) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          name: editingLead.name,
          phone: editingLead.phone,
          email: editingLead.email,
          interesse: editingLead.interesse,
          observacoes: editingLead.observacoes,
          origem: editingLead.origem,
          campanha: editingLead.campanha,
          conjunto: editingLead.conjunto,
          anuncio: editingLead.anuncio,
          status_id: editingLead.status_id,
          temperature: editingLead.temperature,
          assigned_broker_id: (editingLead as any).assigned_broker_id,
          property_id: (editingLead as any).property_id
        })
        .eq('id', editingLead.id);

      if (error) throw error;

      toast({
        title: "Lead atualizado com sucesso!",
        description: "As informações do lead foram atualizadas.",
      });

      setIsEditDialogOpen(false);
      setEditingLead(null);
      fetchData();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar lead",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Lead deletado com sucesso!",
        description: "O lead foi removido do sistema.",
      });

      fetchData();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao deletar lead",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDialogOpen(true);
  };

  const handleStatusChange = async (leadId: string, newStatusId: string) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status_id: newStatusId })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: "O status do lead foi alterado com sucesso.",
      });

      fetchData();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId) return;

    const leadId = draggableId;
    const newStatusId = destination.droppableId;

    handleStatusChange(leadId, newStatusId);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };


  const filteredLeads = leads.filter(lead => {
    // Filtro de busca por texto
    const matchesSearch = searchTerm === "" || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtro por status
    const matchesStatus = filters.status === "" || lead.status_id === filters.status;

    // Filtro por origem
    const matchesOrigem = filters.origem === "" || 
      (lead.origem && lead.origem.toLowerCase().includes(filters.origem.toLowerCase()));

    // Filtro por período
    let matchesDateRange = true;
    if (filters.startDate || filters.endDate) {
      const leadDate = new Date(lead.created_at);
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        matchesDateRange = matchesDateRange && leadDate >= startDate;
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Incluir todo o dia final
        matchesDateRange = matchesDateRange && leadDate <= endDate;
      }
    }

    return matchesSearch && matchesStatus && matchesOrigem && matchesDateRange;
  });

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
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Leads</h1>
            <Badge variant="secondary" className="text-sm">
              {filteredLeads.length} leads
            </Badge>
          </div>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interesse">Interesse</Label>
                    <Input
                      id="interesse"
                      value={newLead.interesse}
                      onChange={(e) => setNewLead({...newLead, interesse: e.target.value})}
                      placeholder="Ex: Apartamento 2 quartos, Casa em condomínio..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperatura</Label>
                    <Select
                      value={newLead.temperature}
                      onValueChange={(value: 'hot' | 'warm' | 'cold') => setNewLead({...newLead, temperature: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a temperatura" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hot">
                          <span className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-red-500" />
                            Quente
                          </span>
                        </SelectItem>
                        <SelectItem value="warm">
                          <span className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-yellow-500" />
                            Morno
                          </span>
                        </SelectItem>
                        <SelectItem value="cold">
                          <span className="flex items-center gap-2">
                            <Snowflake className="h-4 w-4 text-blue-500" />
                            Frio
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

                {canAssignLeads && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Corretor Responsável</Label>
                      <BrokerSelect
                        value={newLead.assigned_broker_id}
                        onValueChange={(value) => setNewLead({...newLead, assigned_broker_id: value})}
                        placeholder="Selecionar corretor"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Imóvel de Interesse</Label>
                      <PropertySelect
                        value={newLead.property_id}
                        onValueChange={(value) => setNewLead({...newLead, property_id: value})}
                        placeholder="Selecionar imóvel"
                      />
                    </div>
                  </div>
                )}

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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
                {(filters.status || filters.origem || filters.startDate || filters.endDate) && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">
                    {Object.values(filters).filter(Boolean).length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtros</h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setFilters({ status: "", origem: "", startDate: "", endDate: "" })}
                  >
                    Limpar
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="filter-status">Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters({...filters, status: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os status" />
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="filter-origem">Origem</Label>
                    <Input
                      id="filter-origem"
                      placeholder="Ex: Facebook, Google..."
                      value={filters.origem}
                      onChange={(e) => setFilters({...filters, origem: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="filter-start-date">Data inicial</Label>
                      <Input
                        id="filter-start-date"
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="filter-end-date">Data final</Label>
                      <Input
                        id="filter-end-date"
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
          
          <Button
            variant={notificationsEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={toggleNotifications}
            className="gap-2"
            title={notificationsEnabled ? 'Desativar notificações sonoras' : 'Ativar notificações sonoras'}
          >
            {notificationsEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {notificationsEnabled ? 'Sons On' : 'Sons Off'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        // Kanban View with Drag and Drop
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max flex-nowrap">
              {statuses.map((status) => {
                const statusLeads = getLeadsByStatus(status.id);
                return (
                  <div key={status.id} className="kanban-column w-[330px] flex-none">
                    <div 
                      className="flex items-center gap-3 mb-4 p-3 rounded-lg"
                      style={{ background: `linear-gradient(135deg, ${status.color}20 0%, transparent 100%)` }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm" 
                        style={{ backgroundColor: status.color, boxShadow: `0 0 8px ${status.color}50` }}
                      />
                      <h3 className="font-semibold flex-1">{status.name}</h3>
                      <Badge 
                        variant="secondary" 
                        className="font-bold"
                        style={{ backgroundColor: `${status.color}20`, color: status.color }}
                      >
                        {statusLeads.length}
                      </Badge>
                    </div>
                    
                     <Droppable droppableId={status.id}>
                       {(provided, snapshot) => (
                         <div
                           ref={provided.innerRef}
                           {...provided.droppableProps}
                           className={`space-y-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto p-2 rounded-lg transition-colors ${
                             snapshot.isDraggingOver ? 'bg-muted/50' : ''
                           }`}
                         >
                           {statusLeads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`lead-card transition-transform cursor-pointer ${
                                    snapshot.isDragging ? 'rotate-2 scale-105 shadow-lg' : ''
                                  }`}
                                  onDoubleClick={() => handleViewDetails(lead)}
                                >
                                   <div className="flex items-start justify-between mb-2">
                                     <div>
                                       <div className="flex items-center gap-2 flex-wrap">
                                         <h4 className="font-medium text-sm">{lead.name}</h4>
                                         <TemperatureBadge temperature={lead.temperature} showLabel={false} size="sm" />
                                         <OriginBadge origem={lead.origem} showLabel={false} size="sm" />
                                       </div>
                                       <span className="text-xs text-muted-foreground">{formatDate(lead.created_at)}</span>
                                     </div>
                                     <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <MoreVertical className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleViewDetails(lead)}>
                                          <Eye className="h-4 w-4 mr-2" />
                                          Ver detalhes
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEditLead(lead)}>
                                          <Edit className="h-4 w-4 mr-2" />
                                          Editar lead
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => handleDeleteLead(lead.id)}
                                          className="text-destructive"
                                        >
                                          <Trash className="h-4 w-4 mr-2" />
                                          Deletar
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  
                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <span>📞</span>
                                      {formatPhone(lead.phone)}
                                    </div>
                                    {lead.email && (
                                      <div className="flex items-center gap-1">
                                        <span>📧</span>
                                        {lead.email}
                                      </div>
                                    )}
                                    {lead.interesse && (
                                      <div className="text-xs">
                                        Interesse: {lead.interesse}
                                      </div>
                                    )}
                                    {lead.properties && (
                                      <div className="text-xs flex items-center gap-1">
                                        <span className="text-amber-500">🏠</span>
                                        <span className="truncate">{lead.properties.title}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-2 mt-3">
                                    <WhatsAppMessagePopover 
                                      phone={lead.phone} 
                                      leadName={lead.name}
                                      interesse={lead.interesse}
                                    >
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="flex-1 h-7 text-xs gap-1"
                                      >
                                        <MessageCircle className="h-3 w-3" />
                                        WhatsApp
                                      </Button>
                                    </WhatsAppMessagePopover>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
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
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onDoubleClick={() => handleViewDetails(lead)}
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
                        {lead.properties && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            🏠 {lead.properties.title}
                          </p>
                        )}
                        {!lead.properties && (
                          <p className="text-sm text-muted-foreground">
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {lead.lead_status && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border gap-1"
                                style={{ 
                                  borderColor: lead.lead_status.color,
                                  color: lead.lead_status.color 
                                }}
                              >
                                {lead.lead_status.name}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50 bg-background border">
                              {statuses.map((status) => (
                                <DropdownMenuItem 
                                  key={status.id}
                                  onClick={() => handleStatusChange(lead.id, status.id)}
                                  className="flex items-center gap-2"
                                >
                                  <div 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: status.color }}
                                  />
                                  {status.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <WhatsAppMessagePopover 
                        phone={lead.phone} 
                        leadName={lead.name}
                        interesse={lead.interesse}
                      >
                        <Button 
                          size="sm" 
                          variant="outline"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </WhatsAppMessagePopover>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50 bg-background border">
                          <DropdownMenuItem onClick={() => handleViewDetails(lead)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditLead(lead)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar lead
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteLead(lead.id)}
                            className="text-destructive"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>
              Atualize as informações do lead.
            </DialogDescription>
          </DialogHeader>
          {editingLead && (
            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome *</Label>
                  <Input
                    id="edit-name"
                    value={editingLead.name}
                    onChange={(e) => setEditingLead({...editingLead, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone *</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editingLead.phone}
                    onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingLead.email || ""}
                    onChange={(e) => setEditingLead({...editingLead, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingLead.status_id || ""}
                    onValueChange={(value) => setEditingLead({...editingLead, status_id: value})}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-interesse">Interesse</Label>
                  <Input
                    id="edit-interesse"
                    value={editingLead.interesse || ""}
                    onChange={(e) => setEditingLead({...editingLead, interesse: e.target.value})}
                    placeholder="Ex: Apartamento 2 quartos, Casa em condomínio..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-temperature">Temperatura</Label>
                  <Select
                    value={editingLead.temperature || "warm"}
                    onValueChange={(value) => setEditingLead({...editingLead, temperature: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a temperatura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hot">
                        <span className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-red-500" />
                          Quente
                        </span>
                      </SelectItem>
                      <SelectItem value="warm">
                        <span className="flex items-center gap-2">
                          <Thermometer className="h-4 w-4 text-yellow-500" />
                          Morno
                        </span>
                      </SelectItem>
                      <SelectItem value="cold">
                        <span className="flex items-center gap-2">
                          <Snowflake className="h-4 w-4 text-blue-500" />
                          Frio
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-origem">Origem</Label>
                  <Input
                    id="edit-origem"
                    value={editingLead.origem || ""}
                    onChange={(e) => setEditingLead({...editingLead, origem: e.target.value})}
                    placeholder="Ex: Facebook, Google, Indicação..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-campanha">Campanha</Label>
                  <Input
                    id="edit-campanha"
                    value={editingLead.campanha || ""}
                    onChange={(e) => setEditingLead({...editingLead, campanha: e.target.value})}
                  />
                </div>
              </div>

              {canAssignLeads && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Corretor Responsável</Label>
                    <BrokerSelect
                      value={(editingLead as any).assigned_broker_id || null}
                      onValueChange={(value) => setEditingLead({...editingLead, assigned_broker_id: value} as any)}
                      placeholder="Selecionar corretor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Imóvel de Interesse</Label>
                    <PropertySelect
                      value={(editingLead as any).property_id || null}
                      onValueChange={(value) => setEditingLead({...editingLead, property_id: value} as any)}
                      placeholder="Selecionar imóvel"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-observacoes">Observações</Label>
                <Textarea
                  id="edit-observacoes"
                  value={editingLead.observacoes || ""}
                  onChange={(e) => setEditingLead({...editingLead, observacoes: e.target.value})}
                  placeholder="Informações adicionais sobre o lead..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Atualizando..." : "Atualizar Lead"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Details Modal */}
      <LeadDetailModal
        lead={selectedLead}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onEdit={handleEditLead}
      />
    </div>
  );
};

export default Leads;