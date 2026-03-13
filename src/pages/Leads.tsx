import { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { 
  Plus, 
  Search, 
  Eye,
  Grid,
  Bell,
  BellOff,
  Flame,
  Thermometer,
  Snowflake,
  EyeOff,
  List
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useLeadNotifications } from "@/hooks/use-lead-notifications";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import LeadDetailModal from "@/components/LeadDetailModal";
import BrokerSelect from "@/components/BrokerSelect";
import PropertySelect from "@/components/PropertySelect";
import LeadsDatabaseView from "@/components/leads/LeadsDatabaseView";
import LeadsFilters from "@/components/leads/LeadsFilters";
import { LeadKanbanCard } from "@/components/LeadKanbanCard";
import LeadMobileCard from "@/components/leads/LeadMobileCard";
import { LeadsSettingsSheet } from "@/components/leads/LeadsSettingsSheet";
import { LeadsHeroStats } from "@/components/leads/LeadsHeroStats";
import DisqualifyLeadModal from "@/components/leads/DisqualifyLeadModal";
import { useWhatsAppFailures, useWhatsAppConnected } from "@/hooks/use-whatsapp-failures";
import { useAccount } from "@/hooks/use-account";

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
  const { account } = useAccount();
  const { hasPermission, isOwner } = usePermissions();
  const isMobile = useIsMobile();
  const canAssignLeads = hasPermission('leads.assign') || isOwner;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'database'>('kanban');
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    statuses: [] as string[],
    temperatures: [] as string[],
    origins: [] as string[],
    campaigns: [] as string[],
    ads: [] as string[],
    interests: [] as string[],
    brokerId: null as string | null,
    propertyId: null as string | null,
    startDate: "",
    endDate: "",
    noBroker: false,
    noProperty: false,
    noActivity: null as number | null,
  });
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('kanban-hidden-columns');
    return saved ? JSON.parse(saved) : [];
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('lead-notifications-enabled') !== 'false'
  );

  // Track WhatsApp failures for visible leads
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const whatsappFailures = useWhatsAppFailures(leadIds);
  // Check if WhatsApp is connected once for this account (to contextualize failures)
  const whatsappConnected = useWhatsAppConnected(account?.id ?? undefined);

  // Silent refresh when new leads arrive (notifications are handled globally in Layout.tsx)
  useLeadNotifications(notificationsEnabled ? () => {
    // Only refresh data - sound/toast/browser notification handled by Layout
    fetchData();
  } : undefined, false); // false = disable notifications here, only use callback for refresh

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

  // Função para alternar visibilidade de colunas
  const toggleColumnVisibility = (statusId: string) => {
    setHiddenColumns(prev => {
      const newHidden = prev.includes(statusId)
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId];
      localStorage.setItem('kanban-hidden-columns', JSON.stringify(newHidden));
      return newHidden;
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Pick<Lead, "id" | "name"> | null>(null);

  // Disqualification modal state
  const [isDisqualifyModalOpen, setIsDisqualifyModalOpen] = useState(false);
  const [disqualifyPending, setDisqualifyPending] = useState<{ leadId: string; leadName: string; statusId: string } | null>(null);

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
      let leadsQuery = supabase
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

      // Se usuário NÃO tem permissão de ver todos, filtrar apenas os atribuídos a ele
      const canViewAll = hasPermission('leads.view_all') || isOwner;
      if (!canViewAll) {
        leadsQuery = leadsQuery.eq('assigned_broker_id', user.id);
      }

      const { data: leadsData, error: leadsError } = await leadsQuery;

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

      // Duplicate detection: check for existing lead with same phone or email
      let isDuplicate = false;
      let duplicateOfLeadId: string | null = null;

      const phoneSuffix = newLead.phone.replace(/\D/g, '').slice(-9);
      if (phoneSuffix.length >= 9) {
        const { data: existingLeads } = await supabase
          .from('leads')
          .select('id, phone, email, created_at')
          .eq('account_id', profile.account_id)
          .order('created_at', { ascending: false });

        if (existingLeads && existingLeads.length > 0) {
          const match = existingLeads.find(l => {
            const existingSuffix = l.phone.replace(/\D/g, '').slice(-9);
            if (existingSuffix.length >= 9 && existingSuffix === phoneSuffix) return true;
            if (newLead.email && l.email && newLead.email.toLowerCase() === l.email.toLowerCase()) return true;
            return false;
          });
          if (match) {
            isDuplicate = true;
            duplicateOfLeadId = match.id;
          }
        }
      }

      const { data: insertedLead, error } = await supabase
        .from('leads')
        .insert([{
          ...newLead,
          status_id: statusId,
          account_id: profile.account_id,
          is_duplicate: isDuplicate,
          duplicate_of_lead_id: duplicateOfLeadId,
        }])
        .select('id')
        .single();

      if (error) throw error;

      // Apply distribution rules to assign broker
      let assignedBrokerId: string | undefined;
      try {
        const distResult = await supabase.functions.invoke('apply-distribution-rules', {
          body: {
            lead_id: insertedLead.id,
            account_id: profile.account_id,
          }
        });
        if (distResult.data?.success) {
          assignedBrokerId = distResult.data.broker_id;
          console.log(`Lead assigned to broker: ${distResult.data.broker_name}`);
        }
      } catch (distError) {
        console.error('Distribution error:', distError);
      }

      // Send notification (with assigned broker if distribution worked)
      try {
        await supabase.functions.invoke('notify-new-lead', {
          body: {
            lead_id: insertedLead.id,
            lead_name: newLead.name,
            lead_phone: newLead.phone,
            lead_email: newLead.email,
            lead_temperature: newLead.temperature || 'cold',
            lead_origem: newLead.origem || 'Manual',
            property_name: null,
            account_id: profile.account_id,
            assigned_broker_id: assignedBrokerId,
          }
        });
      } catch (notifyError) {
        console.error('Notification error:', notifyError);
      }

      // Check for WhatsApp automation (NEW: state machine via whatsapp_automation_control)
      try {
        const { data: automationRule } = await supabase
          .from('whatsapp_automation_rules')
          .select('*')
          .eq('account_id', profile.account_id)
          .eq('trigger_type', 'new_lead')
          .eq('is_active', true)
          .single();

        if (automationRule) {
          const sources = automationRule.trigger_sources || { manual: true };
          const manualEnabled = typeof sources === 'object' && sources !== null 
            ? (sources as Record<string, boolean>).manual !== false 
            : true;

          if (manualEnabled) {
            const { data: session } = await supabase
              .from('whatsapp_sessions')
              .select('status')
              .eq('account_id', profile.account_id)
              .maybeSingle();

            if (session) {
              // Build steps_snapshot
              const stepsSnapshot: { greeting: any[]; followup: any[] } = { greeting: [], followup: [] };

              // Get greeting sequence steps
              const { data: seqSteps } = await supabase
                .from('whatsapp_greeting_sequence_steps')
                .select('*')
                .eq('automation_rule_id', automationRule.id)
                .eq('is_active', true)
                .order('position');

              if (seqSteps && seqSteps.length > 0) {
                for (const step of seqSteps as any[]) {
                  const { data: tmpl } = await supabase
                    .from('whatsapp_templates')
                    .select('template')
                    .eq('id', step.template_id)
                    .single();
                  stepsSnapshot.greeting.push({
                    delay_seconds: step.delay_seconds || 0,
                    template_id: step.template_id,
                    template_content: tmpl?.template || '',
                  });
                }
              } else if (automationRule.template_id) {
                const { data: tmpl } = await supabase
                  .from('whatsapp_templates')
                  .select('template')
                  .eq('id', automationRule.template_id)
                  .single();
                stepsSnapshot.greeting.push({
                  delay_seconds: 0,
                  template_id: automationRule.template_id,
                  template_content: tmpl?.template || '',
                });
              }

              // Get followup steps
              const { data: followUpSteps } = await supabase
                .from('whatsapp_followup_steps')
                .select('*')
                .eq('account_id', profile.account_id)
                .eq('is_active', true)
                .order('position');

              if (followUpSteps && followUpSteps.length > 0) {
                for (const step of followUpSteps as any[]) {
                  const { data: tmpl } = await supabase
                    .from('whatsapp_templates')
                    .select('template')
                    .eq('id', step.template_id)
                    .single();
                  stepsSnapshot.followup.push({
                    delay_minutes: step.delay_minutes,
                    template_id: step.template_id,
                    template_content: tmpl?.template || '',
                  });
                }
              }

              if (stepsSnapshot.greeting.length > 0) {
                const delaySeconds = automationRule.delay_seconds || 0;
                const { error: controlError } = await supabase
                  .from('whatsapp_automation_control')
                  .insert({
                    account_id: profile.account_id,
                    lead_id: insertedLead.id,
                    automation_rule_id: automationRule.id,
                    phone: newLead.phone,
                    current_phase: 'greeting',
                    current_step_position: 0,
                    status: 'active',
                    next_execution_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
                    steps_snapshot: stepsSnapshot,
                  });

                if (controlError) {
                  console.error('Automation control insert error:', controlError);
                } else {
                  console.log(`✅ Automation control created for manual lead ${insertedLead.id}`);
                  supabase.functions.invoke('process-whatsapp-queue').catch((e: any) =>
                    console.log('Queue processing trigger:', e)
                  );
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('WhatsApp automation check error:', e);
      }

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
      // Get the lead data before update to check temperature change
      const leadBefore = leads.find(l => l.id === editingLead.id);
      const oldTemperature = leadBefore?.temperature;
      const newTemperature = editingLead.temperature;

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

      // Send Meta CAPI event if temperature changed to "hot"
      if (oldTemperature !== 'hot' && newTemperature === 'hot') {
        try {
          console.log(`🔥 Temperature changed to hot, sending Meta CAPI event for lead ${editingLead.id}`);
          await supabase.functions.invoke('send-meta-event', {
            body: {
              lead_id: editingLead.id,
              event_name: 'LeadQualificado',
              custom_data: { lead_type: 'qualified' },
            },
          });
          console.log('✅ CAPI event sent for hot lead');
        } catch (capiError) {
          console.error('Error sending Meta CAPI event:', capiError);
          // Don't fail the update if CAPI fails
        }
      }

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

  const requestDeleteLead = (lead: Pick<Lead, "id" | "name">) => {
    setLeadToDelete({ id: lead.id, name: lead.name });
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    await handleDeleteLead(leadToDelete.id);
    setIsDeleteDialogOpen(false);
    setLeadToDelete(null);
  };

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDialogOpen(true);
  };

  const isPerdidoStatus = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    return status?.name === "Perdido";
  };

  const handleStatusChange = async (leadId: string, newStatusId: string) => {
    // Intercept "Perdido" status to show disqualification modal
    if (isPerdidoStatus(newStatusId)) {
      const lead = leads.find(l => l.id === leadId);
      setDisqualifyPending({ leadId, leadName: lead?.name || "Lead", statusId: newStatusId });
      setIsDisqualifyModalOpen(true);
      return;
    }

    await executeStatusChange(leadId, newStatusId);
  };

  const executeStatusChange = async (leadId: string, newStatusId: string) => {
    setLoading(true);

    try {
      // Get the lead data before update for comparison
      const leadBefore = leads.find(l => l.id === leadId);
      const oldStatusId = leadBefore?.status_id;

      const { error } = await supabase
        .from('leads')
        .update({ status_id: newStatusId })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: "O status do lead foi alterado com sucesso.",
      });

      // Send Meta CAPI event if mapping exists
      if (oldStatusId !== newStatusId) {
        try {
          // Check if there's a mapping for this status
          const { data: mapping } = await supabase
            .from('meta_event_mappings')
            .select('event_name, lead_type, is_active')
            .eq('status_id', newStatusId)
            .eq('is_active', true)
            .single();

          if (mapping) {
            console.log(`Sending Meta CAPI event: ${mapping.event_name} for lead ${leadId}`);
            await supabase.functions.invoke('send-meta-event', {
              body: {
                lead_id: leadId,
                event_name: mapping.event_name,
                custom_data: mapping.lead_type ? { lead_type: mapping.lead_type } : {},
              },
            });
          }
        } catch (capiError) {
          console.error('Error sending Meta CAPI event:', capiError);
        }
      }

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



  // Extract unique values for filters
  const uniqueOrigins = useMemo(() => {
    const origins = leads
      .map(lead => lead.origem)
      .filter((origin): origin is string => !!origin);
    return [...new Set(origins)];
  }, [leads]);

  const uniqueCampaigns = useMemo(() => {
    const campaigns = leads
      .map(lead => (lead as any).meta_campaign_name || lead.campanha)
      .filter((c): c is string => !!c);
    return [...new Set(campaigns)];
  }, [leads]);

  const uniqueAds = useMemo(() => {
    const ads = leads
      .map(lead => (lead as any).meta_ad_name || lead.anuncio)
      .filter((a): a is string => !!a);
    return [...new Set(ads)];
  }, [leads]);

  const uniqueInterests = useMemo(() => {
    const interests = leads
      .map(lead => lead.interesse)
      .filter((i): i is string => !!i);
    return [...new Set(interests)];
  }, [leads]);

  const filteredLeads = leads.filter(lead => {
    // Filtro de busca por texto
    const matchesSearch = searchTerm === "" || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtro por status (array)
    const matchesStatus = filters.statuses.length === 0 || 
      (lead.status_id && filters.statuses.includes(lead.status_id));

    // Filtro por temperatura
    const matchesTemperature = filters.temperatures.length === 0 ||
      (lead.temperature && filters.temperatures.includes(lead.temperature));

    // Filtro por origem
    const matchesOrigem = filters.origins.length === 0 || 
      (lead.origem && filters.origins.includes(lead.origem));

    // Filtro por campanha
    const leadCampaign = (lead as any).meta_campaign_name || lead.campanha;
    const matchesCampaign = filters.campaigns.length === 0 ||
      (leadCampaign && filters.campaigns.includes(leadCampaign));

    // Filtro por anúncio
    const leadAd = (lead as any).meta_ad_name || lead.anuncio;
    const matchesAd = filters.ads.length === 0 ||
      (leadAd && filters.ads.includes(leadAd));

    // Filtro por interesse
    const matchesInterest = filters.interests.length === 0 ||
      (lead.interesse && filters.interests.includes(lead.interesse));

    // Filtro por corretor
    const matchesBroker = !filters.brokerId || lead.assigned_broker_id === filters.brokerId;
    const matchesNoBroker = !filters.noBroker || !lead.assigned_broker_id;

    // Filtro por imóvel
    const matchesProperty = !filters.propertyId || lead.property_id === filters.propertyId;
    const matchesNoProperty = !filters.noProperty || !lead.property_id;

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
        endDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && leadDate <= endDate;
      }
    }

    // Filtro por inatividade
    let matchesInactivity = true;
    if (filters.noActivity) {
      const lastActivityDate = new Date(lead.updated_at);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.noActivity);
      matchesInactivity = lastActivityDate < cutoffDate;
    }

    // Auto-ocultar leads "Perdido" após 5 dias (apenas no Kanban)
    const perdidoStatus = statuses.find(s => s.name === "Perdido");
    let shouldHidePerdido = false;
    if (viewMode === 'kanban' && perdidoStatus && lead.status_id === perdidoStatus.id) {
      const leadDate = new Date(lead.updated_at);
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      shouldHidePerdido = leadDate < fiveDaysAgo;
    }

    return matchesSearch && matchesStatus && matchesOrigem && matchesTemperature && 
           matchesCampaign && matchesAd && matchesInterest && matchesBroker && matchesNoBroker &&
           matchesProperty && matchesNoProperty && matchesDateRange && matchesInactivity && !shouldHidePerdido;
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
<div className={cn(
      "flex flex-col",
      isMobile ? "min-h-0" : "h-[calc(100vh-6rem)] overflow-hidden"
    )}>
      {/* Header area */}
      <div className={cn(
        "space-y-4 pb-4 w-full max-w-full min-w-0",
        !isMobile && "shrink-0 overflow-hidden"
      )}>
        {/* Hero Stats Section */}
        <LeadsHeroStats 
          leads={filteredLeads}
          onFilterChange={(filter) => {
            if (filter.type === "clear") {
              setFilters(prev => ({ ...prev, temperatures: [], noBroker: false }));
            } else if (filter.type === "unassigned") {
              setFilters(prev => ({ ...prev, noBroker: true, temperatures: [] }));
            } else if (filter.value) {
              setFilters(prev => ({ ...prev, temperatures: [filter.value as string], noBroker: false }));
            }
          }}
        />

        {/* Title + New Lead Button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          
          <div className="flex gap-2">
            {/* Settings Sheet */}
            <LeadsSettingsSheet />
            
            {/* New Lead Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Lead</span>
                  <span className="sm:hidden">Novo</span>
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

        {/* Filters and Search Row */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Search and Filters Row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11 sm:h-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <LeadsFilters
                statuses={statuses}
                filters={filters}
                onFiltersChange={setFilters}
                uniqueOrigins={uniqueOrigins}
                uniqueCampaigns={uniqueCampaigns}
                uniqueAds={uniqueAds}
                uniqueInterests={uniqueInterests}
              />
            </div>
          </div>
          
          {/* View Toggle Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 sm:gap-2">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="gap-1.5 h-9 px-3"
              >
                <Grid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button
                variant={viewMode === 'database' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('database')}
                className="gap-1.5 h-9 px-3"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
            </div>
            
            <Button
              variant={notificationsEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={toggleNotifications}
              className="gap-1.5 h-9"
              title={notificationsEnabled ? 'Desativar notificações sonoras' : 'Ativar notificações sonoras'}
            >
              {notificationsEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{notificationsEnabled ? 'Sons On' : 'Sons Off'}</span>
            </Button>
          </div>
        </div>

        {/* Hidden columns - Fixed in header area (Desktop only) */}
        {viewMode === 'kanban' && !isMobile && hiddenColumns.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground">Colunas ocultas:</span>
            {hiddenColumns.map(columnId => {
              const status = statuses.find(s => s.id === columnId);
              if (!status) return null;
              return (
                <Button
                  key={columnId}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleColumnVisibility(columnId)}
                  className="gap-2"
                >
                  <Eye className="h-3 w-3" />
                  {status.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable Content Area - horizontal scroll CONTAINED */}
      <div className={cn(
        "flex-1 min-h-0",
        !isMobile && "overflow-hidden"
      )}>
        {viewMode === 'kanban' ? (
          isMobile ? (
            // Mobile: Kanban as Accordion - no extra scroll container needed
            <div className="space-y-2 pb-24">
              <Accordion type="single" collapsible defaultValue={statuses[0]?.id} className="space-y-2">
                {statuses.filter(s => !hiddenColumns.includes(s.id)).map((status) => {
                  const statusLeads = getLeadsByStatus(status.id);
                  return (
                    <AccordionItem 
                      key={status.id} 
                      value={status.id}
                      className="border rounded-xl overflow-hidden glass"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: status.color, boxShadow: `0 0 6px ${status.color}60` }}
                          />
                          <span className="font-semibold text-sm">{status.name}</span>
                          <Badge 
                            variant="secondary" 
                            className="ml-auto mr-2 font-bold text-xs"
                            style={{ backgroundColor: `${status.color}20`, color: status.color }}
                          >
                            {statusLeads.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1">
                        <div className="space-y-3">
                          {statusLeads.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              Nenhum lead neste status
                            </p>
                          ) : (
                            statusLeads.map((lead) => (
                              <LeadMobileCard
                                key={lead.id}
                                lead={lead}
                                onViewDetails={handleViewDetails}
                                onEditLead={handleEditLead}
                                onDeleteLead={(id) => {
                                  const l = leads.find(x => x.id === id);
                                  if (l) requestDeleteLead(l);
                                }}
                                whatsappError={whatsappConnected ? (whatsappFailures.get(lead.id) || null) : null}
                              />
                            ))
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ) : (
            // Desktop: Kanban View with glassmorphism columns
            <DragDropContext onDragEnd={onDragEnd}>
              {/* Visual container for Kanban board - overflow hidden to contain scroll */}
              <div className="h-full flex flex-col overflow-hidden">
                {/* Kanban columns container - horizontal scroll ONLY here */}
                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                  <div className="flex gap-4 h-full min-w-max px-1">
                    {statuses.filter(s => !hiddenColumns.includes(s.id)).map((status) => {
                      const statusLeads = getLeadsByStatus(status.id);
                      return (
                        <div 
                          key={status.id} 
                          className="w-[330px] flex-shrink-0 h-full flex flex-col rounded-xl p-3 bg-transparent"
                        >
                          {/* Column header - Compact */}
                          <div 
                            className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50 shrink-0"
                          >
                            <div 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: status.color, boxShadow: `0 0 8px ${status.color}60` }}
                            />
                            <h3 className="font-semibold text-sm flex-1">{status.name}</h3>
                            <Badge 
                              variant="secondary" 
                              className="font-bold text-xs px-2 py-0.5"
                              style={{ backgroundColor: `${status.color}20`, color: status.color }}
                            >
                              {statusLeads.length}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-40 hover:opacity-100"
                              onClick={() => toggleColumnVisibility(status.id)}
                              title={`Ocultar coluna ${status.name}`}
                            >
                              <EyeOff className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Column content - vertical scroll */}
                          <Droppable droppableId={status.id}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 min-h-0 overflow-y-auto space-y-3 rounded-lg transition-all custom-scrollbar ${
                                  snapshot.isDraggingOver 
                                    ? 'bg-primary/5 ring-2 ring-primary/20 ring-inset' 
                                    : ''
                                }`}
                              >
                                {statusLeads.length === 0 && !snapshot.isDraggingOver && (
                                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <p className="text-sm">Nenhum lead</p>
                                    <p className="text-xs mt-1">Arraste um lead para cá</p>
                                  </div>
                                )}
                                {statusLeads.map((lead, index) => (
                                  <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                    {(provided, snapshot) => {
                                      const draggableStyle = {
                                        ...provided.draggableProps.style,
                                        ...(snapshot.isDragging ? { zIndex: 9999 } : {}),
                                      };
                                      const cardContent = (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          style={draggableStyle}
                                        >
                                          <LeadKanbanCard
                                            lead={lead}
                                            onViewDetails={handleViewDetails}
                                            onEdit={handleEditLead}
                                            onDelete={(id) => {
                                              const l = leads.find(x => x.id === id);
                                              if (l) requestDeleteLead(l);
                                            }}
                                            isDragging={snapshot.isDragging}
                                            whatsappError={whatsappConnected ? (whatsappFailures.get(lead.id) || null) : null}
                                          />
                                        </div>
                                      );
                                      // Portal the card to document.body during drag to escape
                                      // backdrop-filter containers that break position calculations
                                      if (snapshot.isDragging) {
                                        return ReactDOM.createPortal(cardContent, document.body);
                                      }
                                      return cardContent;
                                    }}
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
              </div>
            </DragDropContext>
          )
        ) : viewMode === 'database' ? (
          // Database View
          <div className="h-full overflow-auto">
            <LeadsDatabaseView
              leads={leads}
              statuses={statuses}
              loading={loading}
              onViewDetails={handleViewDetails}
              onEditLead={handleEditLead}
              onDeleteLead={(id) => {
                const lead = leads.find(l => l.id === id);
                if (!lead) return;
                requestDeleteLead(lead);
              }}
              onStatusChange={handleStatusChange}
              onRefresh={fetchData}
            />
          </div>
        ) : null}
      </div>

      {/* Confirm Delete Lead */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setLeadToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover &quot;{leadToDelete?.name ?? "este lead"}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteLead();
              }}
              disabled={loading || !leadToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Disqualify Lead Modal */}
      {disqualifyPending && (
        <DisqualifyLeadModal
          open={isDisqualifyModalOpen}
          onOpenChange={setIsDisqualifyModalOpen}
          leadId={disqualifyPending.leadId}
          leadName={disqualifyPending.leadName}
          statusId={disqualifyPending.statusId}
          onConfirm={() => {
            setIsDisqualifyModalOpen(false);
            setDisqualifyPending(null);
            fetchData();
          }}
          onCancel={() => {
            setIsDisqualifyModalOpen(false);
            setDisqualifyPending(null);
          }}
        />
      )}
    </div>
  );
};

export default Leads;