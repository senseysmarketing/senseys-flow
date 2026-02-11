import { ArrowLeft, Mail, Phone, User, Tag, ThermometerSun, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface LeadPanelProps {
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    temperature: string | null;
    origem: string | null;
    interesse: string | null;
    observacoes: string | null;
    lead_status?: { name: string; color: string } | null;
    properties?: { title: string } | null;
    profiles?: { full_name: string | null } | null;
  };
  onClose: () => void;
  isMobile?: boolean;
}

function TempBadge({ temp }: { temp: string | null }) {
  if (!temp) return null;
  const config: Record<string, { label: string; className: string }> = {
    hot: { label: "Quente", className: "badge-hot" },
    warm: { label: "Morno", className: "badge-warm" },
    cold: { label: "Frio", className: "badge-cold" },
  };
  const c = config[temp] || config.warm;
  return <Badge className={cn("text-[10px]", c.className)}>{c.label}</Badge>;
}

export function LeadPanel({ lead, onClose, isMobile }: LeadPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="text-sm font-semibold">Dados do Lead</h3>
        </div>
        {!isMobile && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Name & Status */}
          <div className="text-center space-y-2">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <h4 className="font-semibold text-lg">{lead.name}</h4>
            <div className="flex items-center justify-center gap-2">
              {lead.lead_status && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: lead.lead_status.color, color: lead.lead_status.color }}
                >
                  {lead.lead_status.name}
                </Badge>
              )}
              <TempBadge temp={lead.temperature} />
            </div>
          </div>

          <Separator />

          {/* Contact info */}
          <div className="space-y-3">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</h5>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-3">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhes</h5>
            <div className="space-y-2.5">
              {lead.origem && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Origem:</span>
                    <p>{lead.origem}</p>
                  </div>
                </div>
              )}
              {lead.interesse && (
                <div className="flex items-center gap-2.5 text-sm">
                  <ThermometerSun className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Interesse:</span>
                    <p>{lead.interesse}</p>
                  </div>
                </div>
              )}
              {lead.properties && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Imóvel:</span>
                    <p>{lead.properties.title}</p>
                  </div>
                </div>
              )}
              {lead.profiles?.full_name && (
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Corretor:</span>
                    <p>{lead.profiles.full_name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {lead.observacoes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</h5>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.observacoes}</p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
