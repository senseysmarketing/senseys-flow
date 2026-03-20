import { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Plus, Search, Eye, Grid, Bell, BellOff, EyeOff, List
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useLeadNotifications } from "@/hooks/use-lead-notifications";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLeads } from "@/hooks/use-leads";
import { useWhatsAppFailures, useWhatsAppConnected } from "@/hooks/use-whatsapp-failures";
import { useAccount } from "@/hooks/use-account";

import LeadDetailModal from "@/components/LeadDetailModal";
import LeadsDatabaseView from "@/components/leads/LeadsDatabaseView";
import LeadsFilters from "@/components/leads/LeadsFilters";
import { LeadKanbanCard } from "@/components/LeadKanbanCard";
import LeadMobileCard from "@/components/leads/LeadMobileCard";
import { LeadsSettingsSheet } from "@/components/leads/LeadsSettingsSheet";
import { LeadsHeroStats } from "@/components/leads/LeadsHeroStats";
import DisqualifyLeadModal from "@/components/leads/DisqualifyLeadModal";
import CreateLeadDialog from "@/components/leads/CreateLeadDialog";
import EditLeadDialog from "@/components/leads/EditLeadDialog";
import DeleteLeadDialog from "@/components/leads/DeleteLeadDialog";

import type { Lead } from "@/types/leads";

const Leads = () => {
  const { user } = useAuth();
  const { account } = useAccount();
  const { hasPermission, isOwner } = usePermissions();
  const isMobile = useIsMobile();
  const canAssignLeads = hasPermission("leads.assign") || isOwner;

  const { leads, statuses, isLoading, deleteLead, changeStatus, refresh } = useLeads();

  const [viewMode, setViewMode] = useState<"kanban" | "database">("kanban");
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
    const saved = localStorage.getItem("kanban-hidden-columns");
    return saved ? JSON.parse(saved) : [];
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem("lead-notifications-enabled") !== "false"
  );

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Pick<Lead, "id" | "name"> | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDisqualifyOpen, setIsDisqualifyOpen] = useState(false);
  const [disqualifyPending, setDisqualifyPending] = useState<{ leadId: string; leadName: string; statusId: string } | null>(null);

  // WhatsApp failures
  const leadIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const whatsappFailures = useWhatsAppFailures(leadIds);
  const whatsappConnected = useWhatsAppConnected(account?.id ?? undefined);

  // Silent refresh on new leads
  useLeadNotifications(
    notificationsEnabled ? () => refresh() : undefined,
    false
  );

  const toggleNotifications = () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    localStorage.setItem("lead-notifications-enabled", newState.toString());
    toast({
      title: newState ? "🔔 Notificações Ativadas" : "🔕 Notificações Desativadas",
      description: newState
        ? "Você receberá sons e alertas quando novos leads forem adicionados"
        : "Não receberá mais notificações sonoras de novos leads",
    });
  };

  const toggleColumnVisibility = (statusId: string) => {
    setHiddenColumns((prev) => {
      const newHidden = prev.includes(statusId)
        ? prev.filter((id) => id !== statusId)
        : [...prev, statusId];
      localStorage.setItem("kanban-hidden-columns", JSON.stringify(newHidden));
      return newHidden;
    });
  };

  // Unique filter values
  const uniqueOrigins = useMemo(() => [...new Set(leads.map((l) => l.origem).filter(Boolean) as string[])], [leads]);
  const uniqueCampaigns = useMemo(() => [...new Set(leads.map((l) => l.meta_campaign_name || l.campanha).filter(Boolean) as string[])], [leads]);
  const uniqueAds = useMemo(() => [...new Set(leads.map((l) => l.meta_ad_name || l.anuncio).filter(Boolean) as string[])], [leads]);
  const uniqueInterests = useMemo(() => [...new Set(leads.map((l) => l.interesse).filter(Boolean) as string[])], [leads]);

  // Filtered leads with useMemo
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = searchTerm === "" ||
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filters.statuses.length === 0 ||
        (lead.status_id && filters.statuses.includes(lead.status_id));

      const matchesTemperature = filters.temperatures.length === 0 ||
        (lead.temperature && filters.temperatures.includes(lead.temperature));

      const matchesOrigem = filters.origins.length === 0 ||
        (lead.origem && filters.origins.includes(lead.origem));

      const leadCampaign = lead.meta_campaign_name || lead.campanha;
      const matchesCampaign = filters.campaigns.length === 0 ||
        (leadCampaign && filters.campaigns.includes(leadCampaign));

      const leadAd = lead.meta_ad_name || lead.anuncio;
      const matchesAd = filters.ads.length === 0 ||
        (leadAd && filters.ads.includes(leadAd));

      const matchesInterest = filters.interests.length === 0 ||
        (lead.interesse && filters.interests.includes(lead.interesse));

      const matchesBroker = !filters.brokerId || lead.assigned_broker_id === filters.brokerId;
      const matchesNoBroker = !filters.noBroker || !lead.assigned_broker_id;
      const matchesProperty = !filters.propertyId || lead.property_id === filters.propertyId;
      const matchesNoProperty = !filters.noProperty || !lead.property_id;

      let matchesDateRange = true;
      if (filters.startDate || filters.endDate) {
        const leadDate = new Date(lead.created_at);
        if (filters.startDate) matchesDateRange = matchesDateRange && leadDate >= new Date(filters.startDate);
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && leadDate <= endDate;
        }
      }

      let matchesInactivity = true;
      if (filters.noActivity) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filters.noActivity);
        matchesInactivity = new Date(lead.updated_at) < cutoff;
      }

      // Auto-hide "Perdido" after 5 days in kanban
      const perdidoStatus = statuses.find((s) => s.name === "Perdido");
      let shouldHidePerdido = false;
      if (viewMode === "kanban" && perdidoStatus && lead.status_id === perdidoStatus.id) {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        shouldHidePerdido = new Date(lead.updated_at) < fiveDaysAgo;
      }

      return matchesSearch && matchesStatus && matchesOrigem && matchesTemperature &&
        matchesCampaign && matchesAd && matchesInterest && matchesBroker && matchesNoBroker &&
        matchesProperty && matchesNoProperty && matchesDateRange && matchesInactivity && !shouldHidePerdido;
    });
  }, [leads, searchTerm, filters, statuses, viewMode]);

  const getLeadsByStatus = (statusId: string) => filteredLeads.filter((lead) => lead.status_id === statusId);

  // Handlers
  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setIsEditOpen(true);
  };

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const requestDeleteLead = (lead: Pick<Lead, "id" | "name">) => {
    setLeadToDelete(lead);
    setIsDeleteOpen(true);
  };

  const isPerdidoStatus = (statusId: string) => statuses.find((s) => s.id === statusId)?.name === "Perdido";

  const handleStatusChange = async (leadId: string, newStatusId: string) => {
    if (isPerdidoStatus(newStatusId)) {
      const lead = leads.find((l) => l.id === leadId);
      setDisqualifyPending({ leadId, leadName: lead?.name || "Lead", statusId: newStatusId });
      setIsDisqualifyOpen(true);
      return;
    }
    changeStatus.mutate({ leadId, statusId: newStatusId });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    handleStatusChange(draggableId, destination.droppableId);
  };

  if (isLoading) {
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
        <LeadsHeroStats
          leads={filteredLeads}
          onFilterChange={(filter) => {
            if (filter.type === "clear") {
              setFilters((prev) => ({ ...prev, temperatures: [], noBroker: false }));
            } else if (filter.type === "unassigned") {
              setFilters((prev) => ({ ...prev, noBroker: true, temperatures: [] }));
            } else if (filter.value) {
              setFilters((prev) => ({ ...prev, temperatures: [filter.value as string], noBroker: false }));
            }
          }}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <div className="flex gap-2">
            <LeadsSettingsSheet filteredLeads={filteredLeads} />
            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Lead</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
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

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 sm:gap-2">
              <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")} className="gap-1.5 h-9 px-3">
                <Grid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button variant={viewMode === "database" ? "default" : "outline"} size="sm" onClick={() => setViewMode("database")} className="gap-1.5 h-9 px-3">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
            </div>
            <Button variant={notificationsEnabled ? "default" : "outline"} size="sm" onClick={toggleNotifications} className="gap-1.5 h-9" title={notificationsEnabled ? "Desativar notificações sonoras" : "Ativar notificações sonoras"}>
              {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{notificationsEnabled ? "Sons On" : "Sons Off"}</span>
            </Button>
          </div>
        </div>

        {viewMode === "kanban" && !isMobile && hiddenColumns.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground">Colunas ocultas:</span>
            {hiddenColumns.map((columnId) => {
              const status = statuses.find((s) => s.id === columnId);
              if (!status) return null;
              return (
                <Button key={columnId} variant="outline" size="sm" onClick={() => toggleColumnVisibility(columnId)} className="gap-2">
                  <Eye className="h-3 w-3" />
                  {status.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-h-0", !isMobile && "overflow-hidden")}>
        {viewMode === "kanban" ? (
          isMobile ? (
            <div className="space-y-2 pb-24">
              <Accordion type="single" collapsible defaultValue={statuses[0]?.id} className="space-y-2">
                {statuses.filter((s) => !hiddenColumns.includes(s.id)).map((status) => {
                  const statusLeads = getLeadsByStatus(status.id);
                  return (
                    <AccordionItem key={status.id} value={status.id} className="border rounded-xl overflow-hidden glass">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color, boxShadow: `0 0 6px ${status.color}60` }} />
                          <span className="font-semibold text-sm">{status.name}</span>
                          <Badge variant="secondary" className="ml-auto mr-2 font-bold text-xs" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                            {statusLeads.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1">
                        <div className="space-y-3">
                          {statusLeads.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead neste status</p>
                          ) : (
                            statusLeads.map((lead) => (
                              <LeadMobileCard
                                key={lead.id}
                                lead={lead}
                                onViewDetails={handleViewDetails}
                                onEditLead={handleEditLead}
                                onDeleteLead={(id) => {
                                  const l = leads.find((x) => x.id === id);
                                  if (l) requestDeleteLead(l);
                                }}
                                whatsappError={whatsappConnected ? whatsappFailures.get(lead.id) || null : null}
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
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="h-full flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                  <div className="flex gap-6 h-full min-w-max px-1">
                    {statuses.filter((s) => !hiddenColumns.includes(s.id)).map((status) => {
                      const statusLeads = getLeadsByStatus(status.id);
                      return (
                        <div key={status.id} className="w-[330px] flex-shrink-0 h-full flex flex-col rounded-xl p-3 bg-transparent">
                          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10 shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color, boxShadow: `0 0 8px ${status.color}60` }} />
                            <h3 className="text-white font-medium text-sm flex-1">{status.name}</h3>
                            <span className="bg-white/10 text-white rounded-full px-2 py-0.5 text-xs font-bold">{statusLeads.length}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-40 hover:opacity-100" onClick={() => toggleColumnVisibility(status.id)} title={`Ocultar coluna ${status.name}`}>
                              <EyeOff className="h-3 w-3" />
                            </Button>
                          </div>
                          <Droppable droppableId={status.id}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 min-h-0 overflow-y-auto space-y-3 rounded-lg transition-all custom-scrollbar ${snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""}`}
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
                                      const draggableStyle = { ...provided.draggableProps.style, ...(snapshot.isDragging ? { zIndex: 9999 } : {}) };
                                      const cardContent = (
                                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={draggableStyle}>
                                          <LeadKanbanCard
                                            lead={lead}
                                            onViewDetails={handleViewDetails}
                                            onEdit={handleEditLead}
                                            onDelete={(id) => {
                                              const l = leads.find((x) => x.id === id);
                                              if (l) requestDeleteLead(l);
                                            }}
                                            isDragging={snapshot.isDragging}
                                            whatsappError={whatsappConnected ? whatsappFailures.get(lead.id) || null : null}
                                          />
                                        </div>
                                      );
                                      if (snapshot.isDragging) return ReactDOM.createPortal(cardContent, document.body);
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
        ) : viewMode === "database" ? (
          <div className="h-full overflow-auto">
            <LeadsDatabaseView
              leads={leads}
              statuses={statuses}
              loading={isLoading}
              onViewDetails={handleViewDetails}
              onEditLead={handleEditLead}
              onDeleteLead={(id) => {
                const lead = leads.find((l) => l.id === id);
                if (lead) requestDeleteLead(lead);
              }}
              onStatusChange={handleStatusChange}
              onRefresh={refresh}
            />
          </div>
        ) : null}
      </div>

      {/* Dialogs */}
      <CreateLeadDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        statuses={statuses}
        canAssignLeads={canAssignLeads}
        onSuccess={refresh}
      />

      <EditLeadDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        lead={editingLead}
        leads={leads}
        statuses={statuses}
        canAssignLeads={canAssignLeads}
        onSuccess={refresh}
      />

      <DeleteLeadDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setLeadToDelete(null);
        }}
        leadName={leadToDelete?.name ?? null}
        loading={deleteLead.isPending}
        onConfirm={async () => {
          if (!leadToDelete) return;
          await deleteLead.mutateAsync(leadToDelete.id);
          setIsDeleteOpen(false);
          setLeadToDelete(null);
        }}
      />

      <LeadDetailModal
        lead={selectedLead}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEditLead}
      />

      {disqualifyPending && (
        <DisqualifyLeadModal
          open={isDisqualifyOpen}
          onOpenChange={setIsDisqualifyOpen}
          leadId={disqualifyPending.leadId}
          leadName={disqualifyPending.leadName}
          statusId={disqualifyPending.statusId}
          onConfirm={() => {
            setIsDisqualifyOpen(false);
            setDisqualifyPending(null);
            refresh();
          }}
          onCancel={() => {
            setIsDisqualifyOpen(false);
            setDisqualifyPending(null);
          }}
        />
      )}
    </div>
  );
};

export default Leads;
