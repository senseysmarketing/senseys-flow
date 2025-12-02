import { Phone, Mail, MoreVertical, Eye, Edit, Trash, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import WhatsAppMessagePopover from "@/components/WhatsAppMessagePopover";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interesse?: string;
  origem?: string;
  created_at: string;
  temperature?: string | null;
}

interface LeadKanbanCardProps {
  lead: Lead;
  onViewDetails: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  isDragging?: boolean;
}

function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "agora";
  if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)}min`;
  if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `há ${Math.floor(diffInSeconds / 86400)}d`;
  
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function LeadKanbanCard({ 
  lead, 
  onViewDetails, 
  onEdit, 
  onDelete,
  isDragging = false 
}: LeadKanbanCardProps) {
  const temperatureBorderColor = {
    hot: "border-l-orange-500",
    warm: "border-l-yellow-500",
    cold: "border-l-blue-400",
  }[lead.temperature || 'warm'] || "border-l-muted";

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 transition-all duration-200 cursor-pointer group border-l-4",
        temperatureBorderColor,
        isDragging 
          ? "rotate-2 scale-105 shadow-xl ring-2 ring-primary/30" 
          : "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
      )}
      onDoubleClick={() => onViewDetails(lead)}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <AvatarFallbackColored name={lead.name} size="sm" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {getRelativeTime(lead.created_at)}
            </span>
            <TemperatureBadge temperature={lead.temperature} showLabel={false} size="sm" />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onViewDetails(lead)}>
              <Eye className="h-4 w-4 mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(lead)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(lead.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="h-4 w-4 mr-2" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{formatPhone(lead.phone)}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      {/* Tags Row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <OriginBadge origem={lead.origem} showLabel={false} size="sm" />
        {lead.interesse && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground truncate max-w-[120px]">
            {lead.interesse}
          </span>
        )}
      </div>

      {/* Action Button */}
      <WhatsAppMessagePopover 
        phone={lead.phone} 
        leadName={lead.name}
        interesse={lead.interesse}
      >
        <Button 
          size="sm" 
          variant="outline" 
          className="w-full h-8 text-xs gap-2 hover:bg-success/10 hover:text-success hover:border-success/30 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
      </WhatsAppMessagePopover>
    </div>
  );
}
