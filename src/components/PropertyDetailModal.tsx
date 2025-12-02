import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import TemperatureBadge from "@/components/TemperatureBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  Building2, MapPin, Bed, Bath, Car, Ruler, Calendar, DollarSign, 
  Users, Eye, TrendingUp, Clock, User, Phone, Mail, ChevronRight,
  Home, CalendarDays, Activity, Edit2, Trash2, CheckCircle, XCircle,
  BookmarkCheck, Key
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Property {
  id: string;
  title: string;
  type: string;
  transaction_type: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  sale_price: number | null;
  rent_price: number | null;
  status: string;
  description: string | null;
  assigned_broker_id: string | null;
  campaign_cost: number | null;
  campaign_name: string | null;
  created_at: string;
  updated_at: string | null;
}

interface PropertyDetailModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenLead?: (leadId: string) => void;
  onEdit?: (property: Property) => void;
  onDelete?: (propertyId: string) => void;
  onStatusChange?: () => void;
}

interface LeadWithStatus {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  temperature: string | null;
  created_at: string;
  assigned_broker_id: string | null;
  lead_status: { name: string; color: string } | null;
}

interface BrokerStats {
  user_id: string;
  full_name: string | null;
  lead_count: number;
  hot_leads: number;
  closed_leads: number;
}

interface PropertyEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  lead_id: string | null;
  lead?: { name: string } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  disponivel: { label: "Disponível", color: "bg-green-500" },
  reservado: { label: "Reservado", color: "bg-yellow-500" },
  vendido: { label: "Vendido", color: "bg-blue-500" },
  alugado: { label: "Alugado", color: "bg-purple-500" },
  inativo: { label: "Inativo", color: "bg-gray-500" },
};

const TYPE_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  terreno: "Terreno",
  comercial: "Comercial",
  rural: "Rural",
};

export function PropertyDetailModal({ property, isOpen, onClose, onOpenLead, onEdit, onDelete, onStatusChange }: PropertyDetailModalProps) {
  const [leads, setLeads] = useState<LeadWithStatus[]>([]);
  const [brokerStats, setBrokerStats] = useState<BrokerStats[]>([]);
  const [events, setEvents] = useState<PropertyEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (property && isOpen) {
      fetchPropertyData();
    }
  }, [property, isOpen]);

  const handleStatusChange = async (newStatus: string) => {
    if (!property) return;
    
    try {
      const { error } = await supabase
        .from("properties")
        .update({ status: newStatus })
        .eq("id", property.id);
      
      if (error) throw error;
      
      toast({
        title: "Status atualizado",
        description: `Imóvel marcado como ${STATUS_LABELS[newStatus]?.label || newStatus}`,
      });
      
      onStatusChange?.();
      onClose();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o status.",
      });
    }
  };

  const handleDelete = async () => {
    if (!property) return;
    onDelete?.(property.id);
    onClose();
  };

  const fetchPropertyData = async () => {
    if (!property) return;
    setLoading(true);

    try {
      // Fetch leads linked to this property
      const { data: leadsData } = await supabase
        .from("leads")
        .select(`
          id, name, phone, email, temperature, created_at, assigned_broker_id,
          lead_status:lead_status(name, color)
        `)
        .eq("property_id", property.id)
        .order("created_at", { ascending: false });

      setLeads((leadsData as LeadWithStatus[]) || []);

      // Calculate broker stats from leads
      const brokerMap = new Map<string, BrokerStats>();
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      for (const lead of leadsData || []) {
        if (lead.assigned_broker_id) {
          const existing = brokerMap.get(lead.assigned_broker_id);
          const profile = profiles?.find(p => p.user_id === lead.assigned_broker_id);
          
          if (existing) {
            existing.lead_count++;
            if (lead.temperature === 'hot') existing.hot_leads++;
            if (lead.lead_status?.name === 'Fechado') existing.closed_leads++;
          } else {
            brokerMap.set(lead.assigned_broker_id, {
              user_id: lead.assigned_broker_id,
              full_name: profile?.full_name || "Sem nome",
              lead_count: 1,
              hot_leads: lead.temperature === 'hot' ? 1 : 0,
              closed_leads: lead.lead_status?.name === 'Fechado' ? 1 : 0,
            });
          }
        }
      }
      setBrokerStats(Array.from(brokerMap.values()));

      // Fetch events for this property
      const { data: eventsData } = await supabase
        .from("events")
        .select(`
          id, title, start_time, end_time, lead_id,
          lead:leads(name)
        `)
        .eq("property_id", property.id)
        .order("start_time", { ascending: false })
        .limit(10);

      setEvents((eventsData as PropertyEvent[]) || []);

    } catch (error) {
      console.error("Error fetching property data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!property) return null;

  const statusInfo = STATUS_LABELS[property.status] || { label: property.status, color: "bg-gray-500" };
  const daysOnMarket = differenceInDays(
    property.status === 'vendido' || property.status === 'alugado' 
      ? new Date(property.updated_at || property.created_at) 
      : new Date(),
    new Date(property.created_at)
  );

  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.temperature === 'hot').length;
  const closedLeads = leads.filter(l => l.lead_status?.name === 'Fechado').length;
  const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : "0";
  const cpl = property.campaign_cost && totalLeads > 0 
    ? (property.campaign_cost / totalLeads) 
    : null;

  const formatPrice = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Detalhes do Imóvel: {property.title}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 pt-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-foreground truncate">{property.title}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={`${statusInfo.color} text-white`}>
                  {statusInfo.label}
                </Badge>
                <Badge variant="outline">
                  {TYPE_LABELS[property.type] || property.type}
                </Badge>
                {property.neighborhood && property.city && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {property.neighborhood}, {property.city}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit?.(property);
                  onClose();
                }}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Editar
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange("disponivel")}
                    className="text-green-600"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Disponível
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange("reservado")}
                    className="text-yellow-600"
                  >
                    <BookmarkCheck className="h-4 w-4 mr-2" />
                    Reservado
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange("vendido")}
                    className="text-blue-600"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Vendido
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange("alugado")}
                    className="text-purple-600"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Alugado
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange("inativo")}
                    className="text-gray-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Inativo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover imóvel?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todos os leads vinculados perderão a associação com este imóvel.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Property specs */}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            {property.area_m2 && (
              <span className="flex items-center gap-1">
                <Ruler className="h-4 w-4" /> {property.area_m2}m²
              </span>
            )}
            {property.bedrooms && (
              <span className="flex items-center gap-1">
                <Bed className="h-4 w-4" /> {property.bedrooms} quartos
              </span>
            )}
            {property.bathrooms && (
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" /> {property.bathrooms} banheiros
              </span>
            )}
            {property.parking_spots && (
              <span className="flex items-center gap-1">
                <Car className="h-4 w-4" /> {property.parking_spots} vagas
              </span>
            )}
          </div>

          {/* Prices */}
          <div className="flex items-center gap-6 mt-4">
            {property.sale_price && (
              <div>
                <p className="text-xs text-muted-foreground">Venda</p>
                <p className="text-xl font-bold text-primary">{formatPrice(property.sale_price)}</p>
              </div>
            )}
            {property.rent_price && (
              <div>
                <p className="text-xs text-muted-foreground">Aluguel</p>
                <p className="text-xl font-bold text-primary">{formatPrice(property.rent_price)}/mês</p>
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(90vh-280px)]">
          <div className="p-6 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-card rounded-lg border p-3 text-center">
                <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
              <div className="bg-card rounded-lg border p-3 text-center">
                <Activity className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <p className="text-2xl font-bold">{hotLeads}</p>
                <p className="text-xs text-muted-foreground">Leads Quentes</p>
              </div>
              <div className="bg-card rounded-lg border p-3 text-center">
                <CalendarDays className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-xs text-muted-foreground">Visitas</p>
              </div>
              <div className="bg-card rounded-lg border p-3 text-center">
                <Clock className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                <p className="text-2xl font-bold">{daysOnMarket}</p>
                <p className="text-xs text-muted-foreground">Dias no Mercado</p>
              </div>
              <div className="bg-card rounded-lg border p-3 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-2xl font-bold">{cpl ? formatPrice(cpl) : "-"}</p>
                <p className="text-xs text-muted-foreground">CPL</p>
              </div>
              <div className="bg-card rounded-lg border p-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversão</p>
              </div>
            </div>

            {/* Campaign info */}
            {(property.campaign_name || property.campaign_cost) && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Campanha
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  {property.campaign_name && (
                    <span>Nome: <strong>{property.campaign_name}</strong></span>
                  )}
                  {property.campaign_cost && (
                    <span>Investimento: <strong>{formatPrice(property.campaign_cost)}</strong></span>
                  )}
                </div>
              </div>
            )}

            {/* Brokers who worked */}
            {brokerStats.length > 0 && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Corretores que Trabalharam ({brokerStats.length})
                </h3>
                <div className="grid gap-2">
                  {brokerStats.map((broker) => (
                    <div 
                      key={broker.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarFallbackColored name={broker.full_name || "?"} size="sm" />
                        <span className="font-medium">{broker.full_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{broker.lead_count} leads</span>
                        <span className="text-orange-500">{broker.hot_leads} quentes</span>
                        <span className="text-green-500">{broker.closed_leads} fechados</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events/Visits */}
            {events.length > 0 && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Visitas Agendadas ({events.length})
                </h3>
                <div className="space-y-2">
                  {events.map((event) => (
                    <div 
                      key={event.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{event.title}</p>
                        {event.lead && (
                          <p className="text-sm text-muted-foreground">
                            Lead: {event.lead.name}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leads */}
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Leads Vinculados ({totalLeads})
              </h3>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lead vinculado a este imóvel
                </p>
              ) : (
                <div className="space-y-2">
                  {leads.map((lead) => (
                    <div 
                      key={lead.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => onOpenLead?.(lead.id)}
                    >
                      <div className="flex items-center gap-3">
                        <AvatarFallbackColored name={lead.name} size="sm" />
                        <div>
                          <p className="font-medium">{lead.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                            {lead.email && (
                              <>
                                <Mail className="h-3 w-3 ml-2" />
                                {lead.email}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lead.lead_status && (
                          <Badge 
                            variant="outline"
                            style={{ 
                              backgroundColor: `${lead.lead_status.color}20`,
                              borderColor: lead.lead_status.color,
                              color: lead.lead_status.color 
                            }}
                          >
                            {lead.lead_status.name}
                          </Badge>
                        )}
                        <TemperatureBadge temperature={lead.temperature} size="sm" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" />
                  Descrição
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {property.description}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
              <span>
                Cadastrado em {format(new Date(property.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              {property.updated_at && (
                <span>
                  Atualizado em {format(new Date(property.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
