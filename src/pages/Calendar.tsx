import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { format, isToday, isSameDay, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  lead_id?: string;
  lead?: {
    name: string;
    phone: string;
  };
}

interface Lead {
  id: string;
  name: string;
  phone: string;
}

const CalendarPage = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    start_time: "",
    end_time: "",
    lead_id: "",
  });

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchLeads();
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          lead:leads(name, phone)
        `)
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Erro ao buscar eventos:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os eventos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone")
        .order("name", { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.start_time || !formData.end_time) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
      });
      return;
    }

    try {
      // Get user's account_id
      const { data: accountData, error: accountError } = await supabase
        .rpc('get_user_account_id');
      
      if (accountError) throw accountError;

      const eventData = {
        title: formData.title,
        description: formData.description || null,
        location: formData.location || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        lead_id: formData.lead_id || null,
        account_id: accountData,
      };

      const { error } = await supabase
        .from("events")
        .insert([eventData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Evento criado com sucesso!",
      });

      setIsDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        location: "",
        start_time: "",
        end_time: "",
        lead_id: "",
      });
      fetchEvents();
    } catch (error) {
      console.error("Erro ao criar evento:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar o evento.",
      });
    }
  };

  const todayEvents = events.filter(event => 
    isToday(new Date(event.start_time))
  );

  const selectedDateEvents = events.filter(event => 
    isSameDay(new Date(event.start_time), selectedDate)
  );

  const upcomingEvents = events.filter(event => 
    new Date(event.start_time) > new Date()
  ).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus eventos e compromissos</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Reunião com cliente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead_id">Lead (opcional)</Label>
                <Select
                  value={formData.lead_id}
                  onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} - {lead.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Início *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Fim *</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Local</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Escritório, Online, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes sobre o evento"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Criar Evento
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Calendário</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Hoje</CardTitle>
              <CardDescription>
                {todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento hoje</p>
              ) : (
                todayEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "HH:mm", { locale: ptBR })} - 
                        {format(new Date(event.end_time), "HH:mm", { locale: ptBR })}
                      </p>
                      {event.lead && (
                        <div className="flex items-center gap-1 mt-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{event.lead.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {selectedDateEvents.length} evento{selectedDateEvents.length !== 1 ? 's' : ''} neste dia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDateEvents.length === 0 ? (
                <p className="text-muted-foreground">Nenhum evento neste dia</p>
              ) : (
                selectedDateEvents.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold">{event.title}</h3>
                      <Badge variant="outline">
                        {format(new Date(event.start_time), "HH:mm", { locale: ptBR })}
                      </Badge>
                    </div>
                    
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(event.start_time), "HH:mm", { locale: ptBR })} - 
                        {format(new Date(event.end_time), "HH:mm", { locale: ptBR })}
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </div>
                      )}
                      
                      {event.lead && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {event.lead.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos Eventos</CardTitle>
              <CardDescription>Seus próximos compromissos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground">Nenhum evento próximo</p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "d MMM, HH:mm", { locale: ptBR })}
                        {event.lead && ` • ${event.lead.name}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;