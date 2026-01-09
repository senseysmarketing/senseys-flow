import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Edit, Trash, Phone, Mail } from "lucide-react";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import WhatsAppButton from "@/components/WhatsAppButton";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interesse?: string;
  origem?: string;
  created_at: string;
  status_id?: string;
  temperature?: string | null;
  lead_status?: {
    name: string;
    color: string;
  };
  properties?: {
    id: string;
    title: string;
  } | null;
}

interface LeadMobileCardProps {
  lead: Lead;
  onViewDetails: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "agora";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}min`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
};

const LeadMobileCard = ({
  lead,
  onViewDetails,
  onEditLead,
  onDeleteLead,
  isSelected,
  onSelect,
}: LeadMobileCardProps) => {
  return (
    <div
      className={`p-4 rounded-xl border bg-card transition-all active:scale-[0.98] ${
        isSelected ? "ring-2 ring-primary bg-primary/5" : ""
      }`}
      onClick={() => onViewDetails(lead)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-semibold text-base truncate">{lead.name}</h4>
            <TemperatureBadge temperature={lead.temperature as any} size="sm" showLabel={false} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{getRelativeTime(lead.created_at)}</span>
            {lead.origem && (
              <>
                <span>•</span>
                <OriginBadge origem={lead.origem} size="sm" showLabel={false} />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {lead.lead_status && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 shrink-0"
              style={{
                borderColor: lead.lead_status.color,
                color: lead.lead_status.color,
                backgroundColor: `${lead.lead_status.color}10`,
              }}
            >
              {lead.lead_status.name}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(lead); }}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditLead(lead); }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDeleteLead(lead.id); }}
                className="text-destructive"
              >
                <Trash className="h-4 w-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono">{formatPhone(lead.phone)}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.interesse && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            💡 {lead.interesse}
          </p>
        )}
        {lead.properties && (
          <p className="text-xs text-muted-foreground">
            🏠 {lead.properties.title}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <WhatsAppButton
          phone={lead.phone}
          leadName={lead.name}
          leadId={lead.id}
          propertyName={lead.properties?.title}
          interesse={lead.interesse}
          className="flex-1 h-10"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => onViewDetails(lead)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default LeadMobileCard;
