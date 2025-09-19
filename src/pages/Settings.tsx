import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Move, User, Settings as SettingsIcon, Palette, MessageCircle, Bell, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import FollowUpSettings from "@/components/FollowUpSettings";
import TeamManagement from "@/components/TeamManagement";
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
}
interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  position: number;
  is_active: boolean;
}
const PRESET_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#64748b", "#374151", "#111827"];
const SettingsPage = () => {
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
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
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchLeadStatuses();
      fetchWhatsAppTemplates();
    }
  }, [user]);
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
        // Atualizar status existente
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
        // Criar novo status
        const maxPosition = Math.max(...leadStatuses.map(s => s.position), -1);

        // Get user's account_id
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
        // Atualizar template existente
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
        // Criar novo template
        const maxPosition = Math.max(...whatsappTemplates.map(t => t.position), -1);

        // Get user's account_id
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

    // Atualizar positions
    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index
    }));
    setLeadStatuses(updatedItems);

    // Salvar no banco
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
      // Reverter mudanças em caso de erro
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
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências do sistema</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="statuses">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Status dos Leads
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="h-4 w-4 mr-2" />
            Mensagens WhatsApp
          </TabsTrigger>
          <TabsTrigger value="followup">
            <Bell className="h-4 w-4 mr-2" />
            Follow-up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
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
        </TabsContent>

        <TabsContent value="team">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="statuses">
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
                                {status.is_default && <Badge variant="outline">Padrão</Badge>}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(status)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                
                                {!status.is_default && <AlertDialog>
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
        </TabsContent>

        <TabsContent value="whatsapp">
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
        </TabsContent>

        <TabsContent value="followup">
          <div className="grid gap-6 md:grid-cols-2">
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
        </TabsContent>
      </Tabs>

      {/* Dialog para criar/editar status */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStatus ? "Editar Status" : "Novo Status"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-name">Nome do Status *</Label>
              <Input id="status-name" value={statusForm.name} onChange={e => setStatusForm({
              ...statusForm,
              name: e.target.value
            })} placeholder="Ex: Qualificado" />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="grid grid-cols-10 gap-2">
                {PRESET_COLORS.map(color => <button key={color} type="button" className={`w-8 h-8 rounded-full border-2 ${statusForm.color === color ? "border-foreground" : "border-transparent"}`} style={{
                backgroundColor: color
              }} onClick={() => setStatusForm({
                ...statusForm,
                color
              })} />)}
              </div>
              
              <div className="flex items-center gap-2">
                <Input type="color" value={statusForm.color} onChange={e => setStatusForm({
                ...statusForm,
                color: e.target.value
              })} className="w-12 h-8 p-0 border-0" />
                <Input value={statusForm.color} onChange={e => setStatusForm({
                ...statusForm,
                color: e.target.value
              })} placeholder="#5a5f65" className="font-mono text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingStatus ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar/editar templates WhatsApp */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Mensagem" : "Nova Mensagem"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTemplateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome da Mensagem *</Label>
              <Input id="template-name" value={templateForm.name} onChange={e => setTemplateForm({
              ...templateForm,
              name: e.target.value
            })} placeholder="Ex: Primeira mensagem" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-text">Mensagem *</Label>
              <Textarea id="template-text" value={templateForm.template} onChange={e => setTemplateForm({
              ...templateForm,
              template: e.target.value
            })} placeholder="Digite sua mensagem aqui. Use {nome} para o nome do lead e {interesse} para o interesse." rows={4} />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {"{nome}"} e {"{interesse}"}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsWhatsAppDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTemplate ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>;
};
export default SettingsPage;