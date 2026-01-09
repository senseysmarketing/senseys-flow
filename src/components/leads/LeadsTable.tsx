import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Eye,
  Edit,
  Trash,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import LeadMobileCard from "./LeadMobileCard";

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
}

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface LeadsTableProps {
  leads: Lead[];
  statuses: LeadStatus[];
  loading: boolean;
  selectedLeads: string[];
  onSelectionChange: (ids: string[]) => void;
  onViewDetails: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onStatusChange: (leadId: string, statusId: string) => void;
  columns: ColumnConfig[];
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
}

const LeadsTable = ({
  leads,
  statuses,
  loading,
  selectedLeads,
  onSelectionChange,
  onViewDetails,
  onEditLead,
  onDeleteLead,
  onStatusChange,
  columns,
  sortColumn,
  sortDirection,
  onSort,
}: LeadsTableProps) => {
  const isMobile = useIsMobile();
  const isAllSelected = leads.length > 0 && selectedLeads.length === leads.length;
  const isSomeSelected = selectedLeads.length > 0 && selectedLeads.length < leads.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(leads.map((l) => l.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedLeads.includes(id)) {
      onSelectionChange(selectedLeads.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedLeads, id]);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getColumnVisible = (key: string) => columns.find((c) => c.key === key)?.visible ?? true;

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Nenhum lead encontrado</p>
        <p className="text-sm mt-1">Ajuste os filtros ou adicione novos leads</p>
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {leads.map((lead) => (
          <LeadMobileCard
            key={lead.id}
            lead={lead}
            onViewDetails={onViewDetails}
            onEditLead={onEditLead}
            onDeleteLead={onDeleteLead}
            isSelected={selectedLeads.includes(lead.id)}
            onSelect={(id) => {
              if (selectedLeads.includes(id)) {
                onSelectionChange(selectedLeads.filter((sid) => sid !== id));
              } else {
                onSelectionChange([...selectedLeads, id]);
              }
            }}
          />
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Selecionar todos"
                  className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                />
              </TableHead>
              {getColumnVisible("name") && (
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => onSort("name")}
                >
                  <div className="flex items-center">
                    Nome
                    {renderSortIcon("name")}
                  </div>
                </TableHead>
              )}
              {getColumnVisible("phone") && <TableHead>Telefone</TableHead>}
              {getColumnVisible("email") && <TableHead>Email</TableHead>}
              {getColumnVisible("status") && <TableHead>Status</TableHead>}
              {getColumnVisible("temperature") && <TableHead>Temp.</TableHead>}
              {getColumnVisible("origin") && <TableHead>Origem</TableHead>}
              {getColumnVisible("property") && <TableHead>Imóvel</TableHead>}
              {getColumnVisible("interesse") && <TableHead>Interesse</TableHead>}
              {getColumnVisible("campanha") && <TableHead>Campanha</TableHead>}
              {getColumnVisible("created_at") && (
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => onSort("created_at")}
                >
                  <div className="flex items-center">
                    Criado em
                    {renderSortIcon("created_at")}
                  </div>
                </TableHead>
              )}
              <TableHead className="w-12">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                className={`cursor-pointer transition-colors ${
                  selectedLeads.includes(lead.id) ? "bg-primary/5" : ""
                }`}
                onDoubleClick={() => onViewDetails(lead)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={() => handleSelectOne(lead.id)}
                    aria-label={`Selecionar ${lead.name}`}
                  />
                </TableCell>
                {getColumnVisible("name") && (
                  <TableCell className="font-medium">{lead.name}</TableCell>
                )}
                {getColumnVisible("phone") && (
                  <TableCell className="font-mono text-sm">{formatPhone(lead.phone)}</TableCell>
                )}
                {getColumnVisible("email") && (
                  <TableCell className="text-muted-foreground text-sm">
                    {lead.email || "-"}
                  </TableCell>
                )}
                {getColumnVisible("status") && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {lead.lead_status && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1.5"
                            style={{
                              borderColor: lead.lead_status.color,
                              color: lead.lead_status.color,
                            }}
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: lead.lead_status.color }}
                            />
                            {lead.lead_status.name}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {statuses.map((status) => (
                            <DropdownMenuItem
                              key={status.id}
                              onClick={() => onStatusChange(lead.id, status.id)}
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
                  </TableCell>
                )}
                {getColumnVisible("temperature") && (
                  <TableCell>
                    <TemperatureBadge temperature={lead.temperature as any} size="sm" />
                  </TableCell>
                )}
                {getColumnVisible("origin") && (
                  <TableCell>
                    {lead.origem ? <OriginBadge origem={lead.origem} /> : "-"}
                  </TableCell>
                )}
                {getColumnVisible("property") && (
                  <TableCell className="text-sm">
                    {lead.properties?.title ? (
                      <Badge variant="outline" className="text-xs">
                        🏠 {lead.properties.title}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                )}
                {getColumnVisible("interesse") && (
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {lead.interesse || "-"}
                  </TableCell>
                )}
                {getColumnVisible("campanha") && (
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.campanha || "-"}
                  </TableCell>
                )}
                {getColumnVisible("created_at") && (
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.created_at)}
                  </TableCell>
                )}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <WhatsAppButton
                      phone={lead.phone}
                      leadName={lead.name}
                      leadId={lead.id}
                      propertyName={lead.properties?.title}
                      interesse={lead.interesse}
                      variant="icon"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(lead)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditLead(lead)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteLead(lead.id)}
                          className="text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeadsTable;
