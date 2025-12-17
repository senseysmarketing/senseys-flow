import { useState, useEffect, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  ChevronsUpDown,
  Clock,
  MapPin,
  User,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { 
  format, 
  isToday, 
  isSameDay, 
  isSameMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  getDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Event colors for visual variety
const EVENT_COLORS = [
  "bg-blue-500/90",
  "bg-green-500/90", 
  "bg-purple-500/90",
  "bg-orange-500/90",
  "bg-pink-500/90",
  "bg-cyan-500/90",
];

const getEventColor = (index: number) => EVENT_COLORS[index % EVENT_COLORS.length];

const CalendarPage = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
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
      setLeadPopoverOpen(false);
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

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(new Date(event.start_time), date));
  };

  // Get events for selected date (sidebar)
  const selectedDateEvents = useMemo(() => {
    return events.filter(event => isSameDay(new Date(event.start_time), selectedDate));
  }, [events, selectedDate]);

  // Navigation handlers
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  const handleEventClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setIsEventDetailOpen(true);
  };

  const openNewEventDialog = (date?: Date) => {
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      setFormData(prev => ({
        ...prev,
        start_time: `${dateStr}T09:00`,
        end_time: `${dateStr}T10:00`,
      }));
    }
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header - Google Calendar style */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="font-medium"
          >
            Hoje
          </Button>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <h1 className="text-xl font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h1>
        </div>

        <Button onClick={() => openNewEventDialog(selectedDate)}>
          <Plus className="h-4 w-4 mr-2" />
          Criar
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 pt-4 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* Mini Calendar */}
          <div className="bg-card rounded-lg border border-border p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setCurrentMonth(date);
                }
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ptBR}
              className="w-full"
              classNames={{
                months: "w-full",
                month: "w-full space-y-2",
                caption: "flex justify-center pt-1 relative items-center text-sm",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem] flex-1 text-center",
                row: "flex w-full mt-1",
                cell: "text-center text-xs p-0 relative flex-1",
                day: cn(
                  "h-7 w-7 p-0 font-normal mx-auto rounded-full hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center"
                ),
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
              }}
            />
          </div>

          {/* Selected Day Events */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-medium text-sm mb-3">
              {isToday(selectedDate) 
                ? "Hoje" 
                : format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </h3>
            
            <ScrollArea className="h-[200px]">
              {selectedDateEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map((event, idx) => (
                    <div 
                      key={event.id}
                      className="p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedEvent(event);
                        setIsEventDetailOpen(true);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", getEventColor(idx))} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.start_time), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-3 text-primary"
              onClick={() => openNewEventDialog(selectedDate)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar evento
            </Button>
          </div>
        </div>

        {/* Main Calendar Grid */}
        <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day) => (
              <div 
                key={day} 
                className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((day, dayIdx) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    "border-b border-r border-border p-1 min-h-[100px] cursor-pointer transition-colors hover:bg-accent/30",
                    !isCurrentMonth && "bg-muted/30",
                    isSelected && "bg-accent/50"
                  )}
                  onClick={() => handleDayClick(day)}
                  onDoubleClick={() => openNewEventDialog(day)}
                >
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                        isTodayDate && "bg-primary text-primary-foreground font-semibold",
                        !isTodayDate && !isCurrentMonth && "text-muted-foreground",
                        !isTodayDate && isCurrentMonth && "text-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-90 transition-opacity",
                          getEventColor(idx)
                        )}
                        onClick={(e) => handleEventClick(event, e)}
                        title={event.title}
                      >
                        <span className="font-medium">
                          {format(new Date(event.start_time), "HH:mm")}
                        </span>
                        {" "}
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1.5 font-medium">
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={leadPopoverOpen}
                    className="w-full justify-between"
                  >
                    {formData.lead_id
                      ? leads.find((lead) => lead.id === formData.lead_id)?.name
                      : "Buscar lead..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Digite o nome do lead..." />
                    <CommandList>
                      <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                      <CommandGroup>
                        {formData.lead_id && (
                          <CommandItem
                            onSelect={() => {
                              setFormData({ ...formData, lead_id: "" });
                              setLeadPopoverOpen(false);
                            }}
                          >
                            <span className="text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                        )}
                        {leads.map((lead) => (
                          <CommandItem
                            key={lead.id}
                            value={lead.name}
                            onSelect={() => {
                              setFormData({ ...formData, lead_id: lead.id });
                              setLeadPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.lead_id === lead.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{lead.name}</span>
                              <span className="text-sm text-muted-foreground">{lead.phone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

      {/* Event Detail Dialog */}
      <Dialog open={isEventDetailOpen} onOpenChange={setIsEventDetailOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-4 h-4 rounded mt-1", getEventColor(0))} />
                    <DialogTitle className="text-lg">{selectedEvent.title}</DialogTitle>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <div>
                    <p className="text-foreground font-medium">
                      {format(new Date(selectedEvent.start_time), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    <p>
                      {format(new Date(selectedEvent.start_time), "HH:mm", { locale: ptBR })} - 
                      {format(new Date(selectedEvent.end_time), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.lead && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedEvent.lead.name}</p>
                      <p className="text-muted-foreground">{selectedEvent.lead.phone}</p>
                    </div>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
