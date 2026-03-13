import { Phone, Mail, MoreVertical, Eye, Edit, Trash, Building2, AlertTriangle, MessageSquareWarning } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import WhatsAppButton from "@/components/WhatsAppButton";
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
  property_id?: string | null;
  is_duplicate?: boolean;
  properties?: {
    id: string;
    title: string;
  } | null;
}

interface LeadKanbanCardProps {
  lead: Lead;
  onViewDetails: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  isDragging?: boolean;
  whatsappError?: string | null;
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
  isDragging = false,
  whatsappError = null,
}: LeadKanbanCardProps) {
  return (
    <motion.div
      whileHover={isDragging ? undefined : { scale: 1.02, y: -5 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 transition-all duration-200 cursor-pointer group",
        "bg-card/80 backdrop-blur-sm border border-border/30",
        isDragging 
          ? "rotate-1 scale-105 shadow-xl ring-2 ring-primary/40" 
          : "hover:shadow-[0_0_20px_hsl(207_45%_66%/0.2)] hover:border-primary/30"
      )}
      onDoubleClick={() => onViewDetails(lead)}
    >
      {/* Header with Avatar and Name */}
      <div className="flex items-start gap-3 mb-3">
        <AvatarFallbackColored name={lead.name} size="sm" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm truncate max-w-[140px] text-foreground">{lead.name}</h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {getRelativeTime(lead.created_at)}
            </span>
            <TemperatureBadge temperature={lead.temperature} showLabel={false} size="sm" />
          </div>
        </div>

        {/* Dropdown appears on hover */}
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

      {/* Contact Info - Compact */}
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span className="truncate font-mono tabular-nums">{formatPhone(lead.phone)}</span>
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
        {lead.is_duplicate && (
          <span className="inline-flex items-center gap-1 text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full border border-warning/20">
            <AlertTriangle className="h-3 w-3" />
            Recorrente
          </span>
        )}
        <OriginBadge origem={lead.origem} showLabel={false} size="sm" />
        {lead.properties && (
          <span className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground truncate max-w-[140px]">
            <Building2 className="h-3 w-3" />
            {lead.properties.title}
          </span>
        )}
      </div>

      {/* Action Button */}
      <div className="relative">
        {whatsappError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-2 -right-2 z-10">
                <MessageSquareWarning className="h-4 w-4 text-warning" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-xs">
              {whatsappError.toLowerCase().includes('não existe no whatsapp') || whatsappError.toLowerCase().includes('não possui whatsapp') || whatsappError.toLowerCase().includes('failed to send')
                ? 'Este número não existe no WhatsApp'
                : 'Falha no envio de WhatsApp'}
            </TooltipContent>
          </Tooltip>
        )}
        <WhatsAppButton 
          phone={lead.phone} 
          leadName={lead.name}
          leadId={lead.id}
          propertyName={lead.properties?.title}
          interesse={lead.interesse}
          className="w-full"
          onShowLead={() => onViewDetails(lead)}
        />
      </div>
    </motion.div>
  );
}