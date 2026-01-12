import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit2, Trash2, Move, User, Settings as SettingsIcon, Palette, MessageCircle, Bell, Users, Webhook, Copy, Check, Building2, Shield, Shuffle, Target, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useIsMobile } from "@/hooks/use-mobile";
import FollowUpSettings from "@/components/FollowUpSettings";
import TeamManagement from "@/components/TeamManagement";
import WhiteLabelSettings from "@/components/WhiteLabelSettings";
import RolePermissionsManager from "@/components/RolePermissionsManager";
import DistributionRulesManager from "@/components/DistributionRulesManager";
import MetaFormScoringManager from "@/components/MetaFormScoringManager";
import MetaEventMappingManager from "@/components/MetaEventMappingManager";
import { NotificationSettings } from "@/components/NotificationSettings";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
}
interface LeadStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  is_system: boolean;
}
interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  position: number;
  is_active: boolean;
}
const PRESET_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#64748b", "#374151", "#111827"];

interface Property {
  id: string;
  title: string;
  type: string;
  city: string | null;
}

type TabValue = 'profile' | 'team' | 'notifications' | 'statuses' | 'whatsapp' | 'followup' | 'distribution' | 'webhook' | 'qualification' | 'metacapi' | 'permissions' | 'whitelabel';
type CategoryValue = 'geral' | 'leads' | 'integracoes' | 'avancado';

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  permission?: string;
}

interface NavGroup {
  title: string;
  category: CategoryValue;
  items: NavItem[];
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabValue>('profile');
  const [activeCategory, setActiveCategory] = useState<CategoryValue>('geral');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [statusForm, setStatusForm] = useState({
    name: "",
    color: "#5a5f65"
  });
  const [templateForm, setTemplateForm] = useState({
    name: "",
    template: ""
  });
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    timezone: "America/Sao_Paulo"
  });
  const [accountId, setAccountId] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Navigation structure with categories
  const navGroups: NavGroup[] = [
    {
      title: "Geral",
      category: 'geral',
      items: [
        { value: 'profile', label: 'Perfil', icon: <User className="h-4 w-4" /> },
        { value: 'team', label: 'Equipe', icon: <Users className="h-4 w-4" /> },
        { value: 'notifications', label: 'Notificações', icon: <Bell className="h-4 w-4" /> },
      ]
    },
    {
      title: "Gestão de Leads",
      category: 'leads',
      items: [
        { value: 'statuses', label: 'Status dos Leads', icon: <Palette className="h-4 w-4" /> },
        { value: 'followup', label: 'Follow-up', icon: <Bell className="h-4 w-4" /> },
        { value: 'distribution', label: 'Distribuição', icon: <Shuffle className="h-4 w-4" /> },
        { value: 'qualification', label: 'Qualificação', icon: <Target className="h-4 w-4" /> },
      ]
    },
    {
      title: "Integrações",
      category: 'integracoes',
      items: [
        { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
        { value: 'webhook', label: 'Webhook', icon: <Webhook className="h-4 w-4" /> },
        { value: 'metacapi', label: 'Eventos Meta', icon: <Send className="h-4 w-4" /> },
      ]
    },
    {
      title: "Avançado",
      category: 'avancado',
      items: [
        { value: 'permissions', label: 'Permissões', icon: <Shield className="h-4 w-4" />, permission: 'settings.manage' },
        { value: 'whitelabel', label: 'White Label', icon: <Building2 className="h-4 w-4" /> },
      ]
    }
  ];

  // Get current category group
  const currentCategoryGroup = navGroups.find(g => g.category === activeCategory);
  const currentCategoryItems = currentCategoryGroup?.items.filter(item => 
    !item.permission || hasPermission(item.permission)
  ) || [];

  // Handle category change
  const handleCategoryChange = (category: CategoryValue) => {
    setActiveCategory(category);
    const group = navGroups.find(g => g.category === category);
    const visibleItems = group?.items.filter(item => !item.permission || hasPermission(item.permission)) || [];
    if (visibleItems.length > 0) {
      setActiveTab(visibleItems[0].value);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchLeadStatuses();
      fetchWhatsAppTemplates();
      fetchAccountId();
      fetchProperties();
    }
  }, [user]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, type, city")
        .order("title");
      
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
    }
  };

  const fetchAccountId = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user!.id)
        .single();
      
      if (error) throw error;
      setAccountId(data.account_id);
    } catch (error) {
      console.error("Erro ao buscar account_id:", error);
    }
  };

  const fetchProfile = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      setProfile(data);
      setProfileForm({
        full_name: data.full_name || "",
        timezone: data.timezone || "America/Sao_Paulo"
      });
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
    }
  };

  const fetchLeadStatuses = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("lead_status").select("*").order("position", {
        ascending: true
      });
      if (error) throw error;
      setLeadStatuses(data || []);
    } catch (error) {
      console.error("Erro ao buscar status:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os status dos leads."
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppTemplates = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("whatsapp_templates").select("*").eq("is_active", true).order("position", {
        ascending: true
      });
      if (error) throw error;
      setWhatsappTemplates(data || []);
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os templates do WhatsApp."
      });
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        error
      } = await supabase.from("profiles").update({
        full_name: profileForm.full_name,
        timezone: profileForm.timezone
      }).eq("user_id", user!.id);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!"
      });
      fetchProfile();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o perfil."
      });
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome do status é obrigatório."
      });
      return;
    }
    try {
      if (editingStatus) {
        const {
          error
        } = await supabase.from("lead_status").update({
          name: statusForm.name,
          color: statusForm.color
        }).eq("id", editingStatus.id);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Status atualizado com sucesso!"
        });
      } else {
        const maxPosition = Math.max(...leadStatuses.map(s => s.position), -1);
        const {
          data: accountData,
          error: accountError
        } = await supabase.rpc('get_user_account_id');
        if (accountError) throw accountError;
        const {
          error
        } = await supabase.from("lead_status").insert([{
          name: statusForm.name,
          color: statusForm.color,
          position: maxPosition + 1,
          is_default: false,
          account_id: accountData
        }]);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Status criado com sucesso!"
        });
      }
      setIsStatusDialogOpen(false);
      setEditingStatus(null);
      setStatusForm({
        name: "",
        color: "#5a5f65"
      });
      fetchLeadStatuses();
    } catch (error) {
      console.error("Erro ao salvar status:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar o status."
      });
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    try {
      const {
        error
      } = await supabase.from("lead_status").delete().eq("id", statusId);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Status removido com sucesso!"
      });
      fetchLeadStatuses();
    } catch (error) {
      console.error("Erro ao remover status:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover o status."
      });
    }
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.template.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e mensagem são obrigatórios."
      });
      return;
    }
    try {
      if (editingTemplate) {
        const {
          error
        } = await supabase.from("whatsapp_templates").update({
          name: templateForm.name,
          template: templateForm.template
        }).eq("id", editingTemplate.id);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Mensagem atualizada com sucesso!"
        });
      } else {
        const maxPosition = Math.max(...whatsappTemplates.map(t => t.position), -1);
        const {
          data: accountData,
          error: accountError
        } = await supabase.rpc('get_user_account_id');
        if (accountError) throw accountError;
        const {
          error
        } = await supabase.from("whatsapp_templates").insert([{
          name: templateForm.name,
          template: templateForm.template,
          position: maxPosition + 1,
          is_active: true,
          account_id: accountData
        }]);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Mensagem criada com sucesso!"
        });
      }
      setIsWhatsAppDialogOpen(false);
      setEditingTemplate(null);
      setTemplateForm({
        name: "",
        template: ""
      });
      fetchWhatsAppTemplates();
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a mensagem."
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const {
        error
      } = await supabase.from("whatsapp_templates").delete().eq("id", templateId);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Mensagem removida com sucesso!"
      });
      fetchWhatsAppTemplates();
    } catch (error) {
      console.error("Erro ao remover template:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover a mensagem."
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const items = Array.from(leadStatuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index
    }));
    setLeadStatuses(updatedItems);

    try {
      const updates = updatedItems.map(item => supabase.from("lead_status").update({
        position: item.position
      }).eq("id", item.id));
      await Promise.all(updates);
      toast({
        title: "Sucesso",
        description: "Ordem dos status atualizada!"
      });
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar a ordem."
      });
      fetchLeadStatuses();
    }
  };

  const openEditDialog = (status: LeadStatus) => {
    setEditingStatus(status);
    setStatusForm({
      name: status.name,
      color: status.color
    });
    setIsStatusDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingStatus(null);
    setStatusForm({
      name: "",
      color: "#5a5f65"
    });
    setIsStatusDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }

  // Categories for the main tabs
  const categories: { value: CategoryValue; label: string }[] = [
    { value: 'geral', label: 'Geral' },
    { value: 'leads', label: 'Gestão de Leads' },
    { value: 'integracoes', label: 'Integrações' },
    { value: 'avancado', label: 'Avançado' },
  ];

  // Render desktop two-level tabs using Tabs component (same pattern as Reports)
  const renderDesktopTabs = () => (
    <div className="space-y-4">
      {/* Category Tabs (Level 1) - Using Tabs component */}
      <Tabs value={activeCategory} onValueChange={(v) => handleCategoryChange(v as CategoryValue)} className="w-full">
        <TabsList className="flex-wrap">
          {categories.map((cat) => {
            const group = navGroups.find(g => g.category === cat.value);
            const hasVisibleItems = group?.items.some(item => 
              !item.permission || hasPermission(item.permission)
            );
            if (!hasVisibleItems) return null;
            
            return (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Sub-tabs (Level 2) - Using Tabs component */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="flex-wrap">
          {currentCategoryItems.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="gap-2">
              {item.icon}
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );

  // Render mobile tabs with two-level structure
  const renderMobileTabs = () => (
    <div className="space-y-3">
      {/* Categorias (Nível 1) - Grid compacto */}
      <Tabs value={activeCategory} onValueChange={(v) => handleCategoryChange(v as CategoryValue)} className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1">
          {categories.map((cat) => {
            const group = navGroups.find(g => g.category === cat.value);
            const hasVisibleItems = group?.items.some(item => 
              !item.permission || hasPermission(item.permission)
            );
            if (!hasVisibleItems) return null;
            
            return (
              <TabsTrigger 
                key={cat.value} 
                value={cat.value}
                className="text-xs px-1.5 py-1.5"
              >
                {cat.label === "Gestão de Leads" ? "Leads" : 
                 cat.label === "Integrações" ? "Integr." : 
                 cat.label === "Avançado" ? "Avanç." : cat.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Sub-tabs (Nível 2) - Flex wrap */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto p-1 gap-1">
          {currentCategoryItems.map((item) => (
            <TabsTrigger 
              key={item.value} 
              value={item.value} 
              className="flex-1 min-w-[45%] text-xs gap-1.5 py-1.5"
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Atualize suas informações de perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input id="full_name" value={profileForm.full_name} onChange={e => setProfileForm({
                  ...profileForm,
                  full_name: e.target.value
                })} placeholder="Seu nome completo" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Input id="timezone" value={profileForm.timezone} onChange={e => setProfileForm({
                  ...profileForm,
                  timezone: e.target.value
                })} placeholder="America/Sao_Paulo" />
                </div>

                <Button type="submit">
                  Salvar Alterações
                </Button>
              </form>
            </CardContent>
          </Card>
        );

      case 'team':
        return <TeamManagement />;

      case 'notifications':
        return <NotificationSettings />;

      case 'statuses':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Status dos Leads</CardTitle>
                  <CardDescription>
                    Gerencie os status disponíveis para classificar seus leads
                  </CardDescription>
                </div>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Status
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="statuses">
                  {provided => <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {leadStatuses.map((status, index) => <Draggable key={status.id} draggableId={status.id} index={index}>
                          {(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} className={`flex items-center justify-between p-4 border rounded-lg bg-card ${snapshot.isDragging ? "shadow-lg" : ""}`}>
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="cursor-move">
                                  <Move className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="w-4 h-4 rounded-full" style={{
                          backgroundColor: status.color
                        }} />
                                <span className="font-medium">{status.name}</span>
                                {status.is_system && <Badge variant="outline">Sistema</Badge>}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(status)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                
                                {!status.is_system && <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja remover o status "{status.name}"?
                                          Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteStatus(status.id)}>
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>}
                              </div>
                            </div>}
                        </Draggable>)}
                      {provided.placeholder}
                    </div>}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>
        );

      case 'whatsapp':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mensagens WhatsApp</CardTitle>
                  <CardDescription>
                    Configure até 3 mensagens personalizadas para enviar aos leads. Use {"{nome}"} para o nome do lead e {"{interesse}"} para o interesse.
                  </CardDescription>
                </div>
                {whatsappTemplates.length < 3 && <Button onClick={() => {
                setEditingTemplate(null);
                setTemplateForm({
                  name: "",
                  template: ""
                });
                setIsWhatsAppDialogOpen(true);
              }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Mensagem
                  </Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Default message preview */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="font-medium">Mensagem Padrão</span>
                  <Badge variant="outline">Sistema</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Olá {"{nome}"}! Recebi seu cadastro com interesse no(a) {"{interesse}"}. Como posso te ajudar?
                </p>
              </div>

              {/* Custom templates */}
              {whatsappTemplates.map((template, index) => <div key={template.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <span className="font-medium">{template.name}</span>
                      <Badge variant="outline">Personalizada {index + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                    setEditingTemplate(template);
                    setTemplateForm({
                      name: template.name,
                      template: template.template
                    });
                    setIsWhatsAppDialogOpen(true);
                  }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover a mensagem "{template.name}"?
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTemplate(template.id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.template}</p>
                </div>)}

              {whatsappTemplates.length === 0 && <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma mensagem personalizada configurada</p>
                  <p className="text-sm">Crie até 3 mensagens personalizadas para usar com seus leads</p>
                </div>}
            </CardContent>
          </Card>
        );

      case 'followup':
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <FollowUpSettings />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Sobre os Lembretes de Follow-up
                </CardTitle>
                <CardDescription>
                  Como funcionam as notificações automáticas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Detecção Automática</p>
                      <p className="text-sm text-muted-foreground">
                        O sistema identifica automaticamente leads que estão há muito tempo no status "Novo Lead"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Notificações Inteligentes</p>
                      <p className="text-sm text-muted-foreground">Receba alertas em intervalos configuráveis para não esquecer de fazer follow-up</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Priorização</p>
                      <p className="text-sm text-muted-foreground">
                        Leads há mais de 14 dias são marcados como urgentes e recebem destaque especial
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Ação Rápida</p>
                      <p className="text-sm text-muted-foreground">
                        Um clique para marcar leads como contatados e remover dos lembretes
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">💡 Dicas:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Configure intervalos menores para períodos de maior atividade</li>
                    <li>• Use "Apenas Urgentes" para reduzir notificações desnecessárias</li>
                    <li>• Ajuste o threshold de dias conforme sua estratégia de vendas</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'distribution':
        return <DistributionRulesManager />;

      case 'webhook':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Configuração do Webhook
              </CardTitle>
              <CardDescription>
                Receba leads automaticamente através de integrações externas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* URL do Webhook */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    value={`https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/webhook-leads?account_id=${accountId}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/webhook-leads?account_id=${accountId}`
                      );
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                      toast({
                        title: "Copiado!",
                        description: "URL do webhook copiada para a área de transferência",
                      });
                    }}
                  >
                    {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Método e Headers */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Método HTTP</Label>
                <Badge variant="secondary" className="font-mono">POST</Badge>
              </div>

              {/* Exemplo de Payload */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Exemplo de Payload (JSON)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const payload = JSON.stringify({
                        name: "João Silva",
                        phone: "11999999999",
                        email: "joao@email.com",
                        interesse: "Apartamento 3 quartos",
                        origem: "Site",
                        campanha: "Campanha Verão",
                        anuncio: "Anúncio Principal",
                        property_id: "uuid-do-imovel (opcional)"
                      }, null, 2);
                      navigator.clipboard.writeText(payload);
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                      toast({
                        title: "Copiado!",
                        description: "Exemplo de payload copiado",
                      });
                    }}
                  >
                    {copiedPayload ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copiar
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto">
{`{
  "name": "João Silva",
  "phone": "11999999999",
  "email": "joao@email.com",
  "interesse": "Apartamento 3 quartos",
  "origem": "Site",
  "campanha": "Campanha Verão",
  "anuncio": "Anúncio Principal",
  "property_id": "uuid-do-imovel (opcional)"
}`}
                </pre>
              </div>

              {/* Campos Obrigatórios */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Campos Obrigatórios</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge>name</Badge>
                  <Badge>phone</Badge>
                </div>
              </div>

              {/* Lista de Imóveis */}
              {properties.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">IDs dos Imóveis Disponíveis</Label>
                  <p className="text-sm text-muted-foreground">
                    Use o campo <code className="bg-muted px-1 rounded">property_id</code> para vincular o lead a um imóvel específico
                  </p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Imóvel</th>
                          <th className="text-left p-2">ID</th>
                          <th className="w-10 p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {properties.map(property => (
                          <tr key={property.id} className="border-t">
                            <td className="p-2">
                              <div className="font-medium">{property.title}</div>
                              <div className="text-xs text-muted-foreground">{property.type} • {property.city}</div>
                            </td>
                            <td className="p-2 font-mono text-xs">{property.id.slice(0, 8)}...</td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(property.id);
                                  setCopiedPropertyId(property.id);
                                  setTimeout(() => setCopiedPropertyId(null), 2000);
                                  toast({
                                    title: "ID copiado!",
                                    description: `ID do imóvel "${property.title}" copiado`,
                                  });
                                }}
                              >
                                {copiedPropertyId === property.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Teste */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Testar Webhook</Label>
                <p className="text-sm text-muted-foreground">
                  Clique no botão abaixo para enviar um lead de teste
                </p>
                <Button
                  variant="outline"
                  disabled={testingWebhook}
                  onClick={async () => {
                    setTestingWebhook(true);
                    try {
                      const response = await fetch(
                        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/webhook-leads?account_id=${accountId}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: "Lead de Teste",
                            phone: "11999999999",
                            email: "teste@webhook.com",
                            interesse: "Teste de integração",
                            origem: "Webhook Test"
                          })
                        }
                      );
                      
                      if (response.ok) {
                        toast({
                          title: "✅ Teste enviado!",
                          description: "Lead de teste criado com sucesso. Verifique na página de Leads.",
                        });
                      } else {
                        throw new Error('Falha no teste');
                      }
                    } catch (error) {
                      toast({
                        variant: "destructive",
                        title: "Erro no teste",
                        description: "Não foi possível enviar o lead de teste",
                      });
                    } finally {
                      setTestingWebhook(false);
                    }
                  }}
                >
                  {testingWebhook ? "Enviando..." : "Enviar Lead de Teste"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'qualification':
        return <MetaFormScoringManager />;

      case 'metacapi':
        return <MetaEventMappingManager />;

      case 'permissions':
        return hasPermission('settings.manage') ? <RolePermissionsManager /> : null;

      case 'whitelabel':
        return <WhiteLabelSettings />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências do sistema</p>
      </div>

      {/* Mobile: horizontal scrolling tabs */}
      {isMobile && renderMobileTabs()}

      {/* Desktop: two-level tabs + content */}
      {!isMobile && renderDesktopTabs()}

      {/* Content area */}
      <div className="max-w-4xl">
        {renderContent()}
      </div>

      {/* Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStatus ? "Editar Status" : "Novo Status"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-name">Nome do Status</Label>
              <Input
                id="status-name"
                value={statusForm.name}
                onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })}
                placeholder="Ex: Em Negociação"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      statusForm.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setStatusForm({ ...statusForm, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingStatus ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Template Dialog */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Mensagem" : "Nova Mensagem"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTemplateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome da Mensagem</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Ex: Boas-vindas"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template-content">Mensagem</Label>
              <Textarea
                id="template-content"
                value={templateForm.template}
                onChange={(e) => setTemplateForm({ ...templateForm, template: e.target.value })}
                placeholder="Olá {nome}! ..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{nome}"} para o nome do lead e {"{interesse}"} para o interesse
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsWhatsAppDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTemplate ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
