import { Phone, Mail, MoreVertical, Eye, Edit, Trash, Building2, AlertTriangle, MessageSquareWarning, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import TemperatureBadge from "@/components/TemperatureBadge";
import OriginBadge from "@/components/OriginBadge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { WhatsAppChatModal } from "@/components/leads/WhatsAppChatModal";

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
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}min`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getWhatsAppLink(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  return `https://wa.me/${number}`;
}

export function LeadKanbanCard({ 
  lead, 
  onViewDetails, 
  onEdit, 
  onDelete,
  isDragging = false,
  whatsappError = null,
}: LeadKanbanCardProps) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <motion.div
        whileHover={isDragging ? undefined : { scale: 1.02, y: -5 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "relative overflow-hidden rounded-xl p-5 transition-all duration-200 cursor-pointer group",
          "bg-black/20 backdrop-blur-md border border-white/10",
          isDragging 
            ? "rotate-1 scale-105 shadow-xl ring-2 ring-primary/40" 
            : "hover:shadow-[0_0_20px_hsl(207_45%_66%/0.15)] hover:border-white/20"
        )}
        onDoubleClick={() => onViewDetails(lead)}
      >
        {/* Header: Avatar + Name + Time badge + Menu */}
        <div className="flex items-start gap-3">
          <AvatarFallbackColored name={lead.name} size="sm" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-sm truncate max-w-[120px] text-white">{lead.name}</h4>
              <TemperatureBadge temperature={lead.temperature} showLabel={false} size="sm" />
            </div>
          </div>

          {/* Time badge */}
          <span className="text-[11px] text-gray-400 bg-white/5 rounded-full px-2 py-0.5 shrink-0">
            {getRelativeTime(lead.created_at)}
          </span>

          {/* Dropdown on hover */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
              >
                <MoreVertical className="h-3.5 w-3.5" />
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

        {/* Body: Contact info — text only, no icons */}
        <div className="mt-3 space-y-0.5">
          <p className="text-xs text-gray-400 font-mono tabular-nums">{formatPhone(lead.phone)}</p>
          {lead.email && (
            <p className="text-xs text-gray-400 truncate">{lead.email}</p>
          )}
        </div>

        {/* Tags row — subtle */}
        {(lead.is_duplicate || lead.origem || lead.properties) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {lead.is_duplicate && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full border border-warning/20">
                <AlertTriangle className="h-2.5 w-2.5" />
                Recorrente
              </span>
            )}
            <OriginBadge origem={lead.origem} showLabel={false} size="sm" />
            {lead.properties && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-white/5 px-1.5 py-0.5 rounded-full text-gray-400 truncate max-w-[130px]">
                <Building2 className="h-2.5 w-2.5" />
                {lead.properties.title}
              </span>
            )}
          </div>
        )}

        {/* Footer: Icon action buttons */}
        <div className="border-t border-white/5 mt-3 pt-3 flex items-center gap-1">
          {/* WhatsApp */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.15 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#81afd1] transition-colors"
                onClick={(e) => { e.stopPropagation(); setChatOpen(true); }}
              >
                {whatsappError && (
                  <span className="absolute -top-1 -right-1">
                    <MessageSquareWarning className="h-2.5 w-2.5 text-warning" />
                  </span>
                )}
                <MessageCircle className="h-4 w-4" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {whatsappError 
                ? (whatsappError.toLowerCase().includes('não existe') || whatsappError.toLowerCase().includes('failed')
                    ? 'Número não existe no WhatsApp'
                    : 'Falha no envio')
                : 'WhatsApp'}
            </TooltipContent>
          </Tooltip>

          {/* Phone */}
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`tel:${lead.phone}`}
                className="h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Ligar</TooltipContent>
          </Tooltip>

          {/* Email */}
          {lead.email && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`mailto:${lead.email}`}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Email</TooltipContent>
            </Tooltip>
          )}
        </div>
      </motion.div>

      {/* WhatsApp Chat Modal */}
      <WhatsAppChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        leadName={lead.name}
        leadId={lead.id}
        phone={lead.phone}
        propertyName={lead.properties?.title}
        onShowLead={() => onViewDetails(lead)}
      />
    </>
  );
}
