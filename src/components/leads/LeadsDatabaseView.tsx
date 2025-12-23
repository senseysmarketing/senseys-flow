import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import LeadsTable from "./LeadsTable";
import LeadsFilters from "./LeadsFilters";
import LeadsBulkActions from "./LeadsBulkActions";
import LeadsColumnSelector from "./LeadsColumnSelector";
import LeadsPagination from "./LeadsPagination";
import { exportLeadsToCSV } from "./LeadsExport";

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
  meta_campaign_name?: string | null;
  meta_ad_name?: string | null;
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
}

interface LeadsDatabaseViewProps {
  leads: Lead[];
  statuses: LeadStatus[];
  loading: boolean;
  onViewDetails: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onStatusChange: (leadId: string, statusId: string) => void;
  onRefresh: () => void;
}

const defaultColumns = [
  { key: "name", label: "Nome", visible: true },
  { key: "phone", label: "Telefone", visible: true },
  { key: "email", label: "Email", visible: true },
  { key: "status", label: "Status", visible: true },
  { key: "temperature", label: "Temperatura", visible: true },
  { key: "origin", label: "Origem", visible: true },
  { key: "property", label: "Imóvel", visible: true },
  { key: "interesse", label: "Interesse", visible: false },
  { key: "campanha", label: "Campanha", visible: false },
  { key: "created_at", label: "Criado em", visible: true },
];

const LeadsDatabaseView = ({
  leads,
  statuses,
  loading,
  onViewDetails,
  onEditLead,
  onDeleteLead,
  onStatusChange,
  onRefresh,
}: LeadsDatabaseViewProps) => {
  const { hasPermission, isOwner } = usePermissions();
  const canAssign = hasPermission("leads.assign") || isOwner;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [columns, setColumns] = useState(defaultColumns);
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  // Get unique values from leads
  const uniqueOrigins = useMemo(() => {
    const origins = leads.map((l) => l.origem).filter(Boolean) as string[];
    return [...new Set(origins)];
  }, [leads]);

  const uniqueCampaigns = useMemo(() => {
    const campaigns = leads
      .map((l) => l.meta_campaign_name || l.campanha)
      .filter(Boolean) as string[];
    return [...new Set(campaigns)];
  }, [leads]);

  const uniqueAds = useMemo(() => {
    const ads = leads
      .map((l) => l.meta_ad_name || l.anuncio)
      .filter(Boolean) as string[];
    return [...new Set(ads)];
  }, [leads]);

  const uniqueInterests = useMemo(() => {
    const interests = leads.map((l) => l.interesse).filter(Boolean) as string[];
    return [...new Set(interests)];
  }, [leads]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          lead.name.toLowerCase().includes(search) ||
          lead.phone.includes(search) ||
          (lead.email && lead.email.toLowerCase().includes(search)) ||
          (lead.interesse && lead.interesse.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && lead.status_id) {
        if (!filters.statuses.includes(lead.status_id)) return false;
      }

      // Temperature filter
      if (filters.temperatures.length > 0) {
        const temp = lead.temperature || "warm";
        if (!filters.temperatures.includes(temp)) return false;
      }

      // Origin filter
      if (filters.origins.length > 0 && lead.origem) {
        if (!filters.origins.includes(lead.origem)) return false;
      }

      // Broker filter
      if (filters.brokerId && lead.assigned_broker_id !== filters.brokerId) return false;

      // No broker filter
      if (filters.noBroker && lead.assigned_broker_id) return false;

      // Property filter
      if (filters.propertyId && lead.property_id !== filters.propertyId) return false;

      // No property filter
      if (filters.noProperty && lead.property_id) return false;

      // Campaign filter
      if (filters.campaigns.length > 0) {
        const leadCampaign = lead.meta_campaign_name || lead.campanha;
        if (!leadCampaign || !filters.campaigns.includes(leadCampaign)) return false;
      }

      // Ad filter
      if (filters.ads.length > 0) {
        const leadAd = lead.meta_ad_name || lead.anuncio;
        if (!leadAd || !filters.ads.includes(leadAd)) return false;
      }

      // Interest filter
      if (filters.interests.length > 0) {
        if (!lead.interesse || !filters.interests.includes(lead.interesse)) return false;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        const leadDate = new Date(lead.created_at);
        if (filters.startDate && leadDate < new Date(filters.startDate)) return false;
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (leadDate > endDate) return false;
        }
      }

      // No activity filter (leads without recent updates)
      if (filters.noActivity) {
        const updatedAt = new Date(lead.updated_at);
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - filters.noActivity);
        if (updatedAt > daysAgo) return false;
      }

      return true;
    });
  }, [leads, searchTerm, filters]);

  // Sort leads
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof Lead];
      let bVal: any = b[sortColumn as keyof Lead];

      if (sortColumn === "created_at" || sortColumn === "updated_at") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, pageSize]);

  // Clear selection when leads change
  useEffect(() => {
    setSelectedLeads([]);
  }, [leads]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleBulkStatusChange = async (statusId: string) => {
    try {
      for (const leadId of selectedLeads) {
        await onStatusChange(leadId, statusId);
      }
      setSelectedLeads([]);
      toast({ title: `Status alterado para ${selectedLeads.length} lead(s)` });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao alterar status" });
    }
  };

  const handleBulkAssign = async (brokerId: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_broker_id: brokerId })
        .in("id", selectedLeads);

      if (error) throw error;
      setSelectedLeads([]);
      onRefresh();
      toast({ title: `${selectedLeads.length} lead(s) atribuído(s) com sucesso` });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao atribuir leads" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const leadId of selectedLeads) {
        await onDeleteLead(leadId);
      }
      setSelectedLeads([]);
      toast({ title: `${selectedLeads.length} lead(s) deletado(s)` });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao deletar leads" });
    }
  };

  const handleExportSelected = () => {
    const leadsToExport = selectedLeads.length > 0
      ? leads.filter((l) => selectedLeads.includes(l.id))
      : filteredLeads;
    exportLeadsToCSV(leadsToExport);
    toast({ title: `${leadsToExport.length} lead(s) exportado(s)` });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Banco de Dados de Leads</CardTitle>
            <CardDescription>
              {filteredLeads.length} lead(s) encontrado(s)
              {selectedLeads.length > 0 && ` • ${selectedLeads.length} selecionado(s)`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportSelected}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters Bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <LeadsFilters
              statuses={statuses}
              filters={filters}
              onFiltersChange={setFilters}
              uniqueOrigins={uniqueOrigins}
              uniqueCampaigns={uniqueCampaigns}
              uniqueAds={uniqueAds}
              uniqueInterests={uniqueInterests}
            />
            <LeadsColumnSelector columns={columns} onColumnsChange={setColumns} />
          </div>
        </div>

        {/* Bulk Actions */}
        <LeadsBulkActions
          selectedCount={selectedLeads.length}
          statuses={statuses}
          onClearSelection={() => setSelectedLeads([])}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkAssign={handleBulkAssign}
          onBulkDelete={handleBulkDelete}
          onExportSelected={handleExportSelected}
          canAssign={canAssign}
        />

        {/* Table */}
        <LeadsTable
          leads={paginatedLeads}
          statuses={statuses}
          loading={loading}
          selectedLeads={selectedLeads}
          onSelectionChange={setSelectedLeads}
          onViewDetails={onViewDetails}
          onEditLead={onEditLead}
          onDeleteLead={onDeleteLead}
          onStatusChange={onStatusChange}
          columns={columns}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        {/* Pagination */}
        {sortedLeads.length > 0 && (
          <LeadsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedLeads.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default LeadsDatabaseView;
