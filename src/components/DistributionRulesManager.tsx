import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toggle } from "@/components/ui/toggle";
import { 
  Plus, Edit2, Trash2, Shuffle, Building2, Globe, Target, HelpCircle,
  Thermometer, Megaphone, Clock, Scale, MapPin, Layers, AlertCircle,
  Flame, Sun, Snowflake, GripVertical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface DistributionRule {
  id: string;
  name: string;
  rule_type: string;
  conditions: Record<string, any>;
  target_broker_id: string | null;
  priority: number;
  is_active: boolean;
  is_default?: boolean;
}

interface Broker {
  user_id: string;
  full_name: string | null;
}

interface Property {
  id: string;
  title: string;
}

interface LeadStatus {
  id: string;
  name: string;
}

interface RoundRobinConfig {
  id: string;
  broker_order: string[];
  last_broker_index: number;
}

const RULE_TYPES = [
  { value: "round_robin", label: "Round Robin", icon: Shuffle, description: "Distribui leads igualmente entre corretores na ordem definida" },
  { value: "origin", label: "Por Origem", icon: Globe, description: "Direciona leads baseado na origem (Instagram, Facebook, etc.)" },
  { value: "interest", label: "Por Interesse", icon: Target, description: "Direciona leads baseado no interesse declarado" },
  { value: "property", label: "Por Imóvel", icon: Building2, description: "Direciona leads interessados em imóvel específico" },
  { value: "temperature", label: "Por Temperatura", icon: Thermometer, description: "Direciona leads quentes, mornos ou frios para corretores específicos" },
  { value: "campaign", label: "Por Campanha", icon: Megaphone, description: "Direciona leads de campanhas ou conjuntos de anúncios específicos" },
  { value: "time_based", label: "Por Horário", icon: Clock, description: "Distribui baseado no horário e dia da semana de entrada do lead" },
  { value: "workload", label: "Por Carga", icon: Scale, description: "Considera quantos leads ativos cada corretor tem antes de atribuir" },
  { value: "region", label: "Por Região", icon: MapPin, description: "Direciona baseado na localização do imóvel (cidade, estado, bairro)" },
  { value: "compound", label: "Regra Composta", icon: Layers, description: "Combina múltiplas condições usando AND ou OR" },
];

const DAYS_OF_WEEK = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

const DistributionRulesManager = () => {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DistributionRule[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [roundRobinConfig, setRoundRobinConfig] = useState<RoundRobinConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DistributionRule | null>(null);
  
  const [form, setForm] = useState<{
    name: string;
    rule_type: string;
    condition_key: string;
    condition_value: string;
    target_broker_id: string;
    priority: number;
    // Temperature
    temperature: string;
    // Campaign
    campaign: string;
    conjunto: string;
    // Time-based
    start_hour: string;
    end_hour: string;
    days: string[];
    // Workload
    max_active_leads: number;
    active_status_ids: string[];
    // Region
    state: string;
    city: string;
    neighborhood: string;
    // Compound
    compound_operator: string;
    compound_conditions: Array<{ type: string; value: string }>;
  }>({
    name: "",
    rule_type: "round_robin",
    condition_key: "",
    condition_value: "",
    target_broker_id: "",
    priority: 0,
    temperature: "",
    campaign: "",
    conjunto: "",
    start_hour: "09",
    end_hour: "18",
    days: ["seg", "ter", "qua", "qui", "sex"],
    max_active_leads: 20,
    active_status_ids: [],
    state: "",
    city: "",
    neighborhood: "",
    compound_operator: "AND",
    compound_conditions: [],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, brokersRes, propertiesRes, statusesRes, rrRes] = await Promise.all([
        supabase.from("distribution_rules").select("*").order("priority", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("properties").select("id, title").eq("status", "disponivel"),
        supabase.from("lead_status").select("id, name").order("position"),
        supabase.from("broker_round_robin").select("*").limit(1).single(),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (propertiesRes.error) throw propertiesRes.error;

      setRules(rulesRes.data?.map(r => ({
        ...r,
        conditions: r.conditions as Record<string, any>
      })) || []);
      setBrokers(brokersRes.data || []);
      setProperties(propertiesRes.data || []);
      setLeadStatuses(statusesRes.data || []);
      
      if (!rrRes.error && rrRes.data) {
        setRoundRobinConfig({
          id: rrRes.data.id,
          broker_order: (rrRes.data.broker_order as string[]) || [],
          last_broker_index: rrRes.data.last_broker_index || 0,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as regras de distribuição.",
      });
    } finally {
      setLoading(false);
    }
  };

  const buildConditions = () => {
    const conditions: Record<string, any> = {};
    
    switch (form.rule_type) {
      case "origin":
        if (form.condition_value) conditions.origem = form.condition_value;
        break;
      case "interest":
        if (form.condition_value) conditions.interesse = form.condition_value;
        break;
      case "property":
        if (form.condition_value) conditions.property_id = form.condition_value;
        break;
      case "temperature":
        if (form.temperature) conditions.temperature = form.temperature;
        break;
      case "campaign":
        if (form.campaign) conditions.campaign = form.campaign;
        if (form.conjunto) conditions.conjunto = form.conjunto;
        break;
      case "time_based":
        conditions.start_hour = parseInt(form.start_hour) || 9;
        conditions.end_hour = parseInt(form.end_hour) || 18;
        conditions.days = form.days;
        break;
      case "workload":
        conditions.max_active_leads = form.max_active_leads || 20;
        if (form.active_status_ids.length > 0) {
          conditions.active_status_ids = form.active_status_ids;
        }
        break;
      case "region":
        if (form.state) conditions.state = form.state;
        if (form.city) conditions.city = form.city;
        if (form.neighborhood) conditions.neighborhood = form.neighborhood;
        break;
      case "compound":
        conditions.operator = form.compound_operator;
        conditions.conditions = form.compound_conditions;
        break;
    }
    
    return conditions;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome da regra é obrigatório." });
      return;
    }

    // Validate based on rule type
    const needsBroker = !["round_robin", "workload"].includes(form.rule_type);
    if (needsBroker && !form.target_broker_id) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um corretor de destino." });
      return;
    }

    try {
      const { data: accountData, error: accountError } = await supabase.rpc('get_user_account_id');
      if (accountError) throw accountError;

      const conditions = buildConditions();

      const ruleData = {
        name: form.name,
        rule_type: form.rule_type,
        conditions,
        target_broker_id: needsBroker ? form.target_broker_id : null,
        priority: form.priority,
        account_id: accountData,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("distribution_rules")
          .update(ruleData)
          .eq("id", editingRule.id);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Regra atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("distribution_rules")
          .insert([ruleData]);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Regra criada com sucesso!" });
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Erro ao salvar regra:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a regra.",
      });
    }
  };

  const handleToggleActive = async (rule: DistributionRule) => {
    try {
      const { error } = await supabase
        .from("distribution_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);
      
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Erro ao atualizar regra:", error);
    }
  };

  const handleDelete = async (id: string) => {
    // Check if this is the default rule
    const rule = rules.find(r => r.id === id);
    if (rule?.is_default) {
      toast({
        variant: "destructive",
        title: "Não é possível excluir",
        description: "A regra de distribuição padrão não pode ser excluída. Você pode desativá-la ou editar suas configurações.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("distribution_rules")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Sucesso", description: "Regra removida com sucesso!" });
      fetchData();
    } catch (error) {
      console.error("Erro ao remover regra:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover a regra.",
      });
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      rule_type: "round_robin",
      condition_key: "",
      condition_value: "",
      target_broker_id: "",
      priority: 0,
      temperature: "",
      campaign: "",
      conjunto: "",
      start_hour: "09",
      end_hour: "18",
      days: ["seg", "ter", "qua", "qui", "sex"],
      max_active_leads: 20,
      active_status_ids: [],
      state: "",
      city: "",
      neighborhood: "",
      compound_operator: "AND",
      compound_conditions: [],
    });
  };

  const openEditDialog = (rule: DistributionRule) => {
    setEditingRule(rule);
    const conditions = rule.conditions || {};
    
    setForm({
      name: rule.name,
      rule_type: rule.rule_type,
      condition_key: Object.keys(conditions)[0] || "",
      condition_value: conditions.origem || conditions.interesse || conditions.property_id || "",
      target_broker_id: rule.target_broker_id || "",
      priority: rule.priority,
      temperature: conditions.temperature || "",
      campaign: conditions.campaign || "",
      conjunto: conditions.conjunto || "",
      start_hour: String(conditions.start_hour || 9).padStart(2, '0'),
      end_hour: String(conditions.end_hour || 18).padStart(2, '0'),
      days: conditions.days || ["seg", "ter", "qua", "qui", "sex"],
      max_active_leads: conditions.max_active_leads || 20,
      active_status_ids: conditions.active_status_ids || [],
      state: conditions.state || "",
      city: conditions.city || "",
      neighborhood: conditions.neighborhood || "",
      compound_operator: conditions.operator || "AND",
      compound_conditions: conditions.conditions || [],
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const getRuleTypeInfo = (type: string) => {
    return RULE_TYPES.find(t => t.value === type) || RULE_TYPES[0];
  };

  const getConditionLabel = (rule: DistributionRule) => {
    const conditions = rule.conditions || {};
    const parts: string[] = [];
    
    switch (rule.rule_type) {
      case "temperature":
        const tempLabels: Record<string, string> = { hot: "Quente", warm: "Morno", cold: "Frio" };
        parts.push(tempLabels[conditions.temperature] || conditions.temperature);
        break;
      case "campaign":
        if (conditions.campaign) parts.push(`Campanha: ${conditions.campaign}`);
        if (conditions.conjunto) parts.push(`Conjunto: ${conditions.conjunto}`);
        break;
      case "time_based":
        parts.push(`${conditions.start_hour}h-${conditions.end_hour}h`);
        if (conditions.days?.length) parts.push(conditions.days.join(", "));
        break;
      case "workload":
        parts.push(`Máx ${conditions.max_active_leads} leads ativos`);
        break;
      case "region":
        if (conditions.city) parts.push(conditions.city);
        if (conditions.state) parts.push(conditions.state);
        break;
      case "origin":
        parts.push(conditions.origem);
        break;
      case "interest":
        parts.push(conditions.interesse);
        break;
      case "property":
        const property = properties.find(p => p.id === conditions.property_id);
        parts.push(property?.title || conditions.property_id);
        break;
    }
    
    return parts.join(" | ");
  };

  const handleRoundRobinReorder = async (result: DropResult) => {
    if (!result.destination || !roundRobinConfig) return;
    
    const newOrder = Array.from(roundRobinConfig.broker_order.length > 0 
      ? roundRobinConfig.broker_order 
      : brokers.map(b => b.user_id));
    
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);
    
    try {
      const { data: accountData } = await supabase.rpc('get_user_account_id');
      
      if (roundRobinConfig.id) {
        await supabase
          .from("broker_round_robin")
          .update({ broker_order: newOrder })
          .eq("id", roundRobinConfig.id);
      } else {
        await supabase
          .from("broker_round_robin")
          .insert({
            account_id: accountData,
            broker_order: newOrder,
            last_broker_index: 0,
          });
      }
      
      setRoundRobinConfig(prev => prev ? { ...prev, broker_order: newOrder } : null);
      toast({ title: "Sucesso", description: "Ordem atualizada!" });
    } catch (error) {
      console.error("Erro ao reordenar:", error);
    }
  };

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const toggleStatus = (statusId: string) => {
    setForm(prev => ({
      ...prev,
      active_status_ids: prev.active_status_ids.includes(statusId)
        ? prev.active_status_ids.filter(id => id !== statusId)
        : [...prev.active_status_ids, statusId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const orderedBrokers = roundRobinConfig?.broker_order.length 
    ? roundRobinConfig.broker_order.map(id => brokers.find(b => b.user_id === id)).filter(Boolean) as Broker[]
    : brokers;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Regras de Distribuição</CardTitle>
              <CardDescription>
                Configure como os leads são automaticamente distribuídos entre corretores.
                Regras são avaliadas por prioridade (maior primeiro).
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Regra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingRule ? "Editar Regra" : "Nova Regra de Distribuição"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Regra</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Leads quentes para João"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Regra</Label>
                    <Select value={form.rule_type} onValueChange={v => setForm({ ...form, rule_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <div className="flex items-center gap-2">
                              <t.icon className="h-4 w-4" />
                              {t.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {getRuleTypeInfo(form.rule_type).description}
                    </p>
                  </div>

                  <Separator />

                  {/* TEMPERATURE */}
                  {form.rule_type === "temperature" && (
                    <div className="space-y-2">
                      <Label>Temperatura do Lead</Label>
                      <Select value={form.temperature} onValueChange={v => setForm({ ...form, temperature: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a temperatura" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hot">
                            <div className="flex items-center gap-2">
                              <Flame className="w-4 h-4 text-orange-500" />
                              Quente
                            </div>
                          </SelectItem>
                          <SelectItem value="warm">
                            <div className="flex items-center gap-2">
                              <Sun className="w-4 h-4 text-yellow-500" />
                              Morno
                            </div>
                          </SelectItem>
                          <SelectItem value="cold">
                            <div className="flex items-center gap-2">
                              <Snowflake className="w-4 h-4 text-blue-500" />
                              Frio
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* ORIGIN */}
                  {form.rule_type === "origin" && (
                    <div className="space-y-2">
                      <Label>Origem do Lead (contém)</Label>
                      <Input
                        value={form.condition_value}
                        onChange={e => setForm({ ...form, condition_value: e.target.value })}
                        placeholder="Ex: instagram, facebook, site"
                      />
                    </div>
                  )}

                  {/* INTEREST */}
                  {form.rule_type === "interest" && (
                    <div className="space-y-2">
                      <Label>Interesse do Lead (contém)</Label>
                      <Input
                        value={form.condition_value}
                        onChange={e => setForm({ ...form, condition_value: e.target.value })}
                        placeholder="Ex: Apartamento 3 quartos"
                      />
                    </div>
                  )}

                  {/* PROPERTY */}
                  {form.rule_type === "property" && (
                    <div className="space-y-2">
                      <Label>Imóvel Específico</Label>
                      <Select
                        value={form.condition_value}
                        onValueChange={v => setForm({ ...form, condition_value: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o imóvel" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* CAMPAIGN */}
                  {form.rule_type === "campaign" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome da Campanha (contém)</Label>
                        <Input
                          value={form.campaign}
                          onChange={e => setForm({ ...form, campaign: e.target.value })}
                          placeholder="Ex: Lançamento Jardins"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome do Conjunto de Anúncios (opcional)</Label>
                        <Input
                          value={form.conjunto}
                          onChange={e => setForm({ ...form, conjunto: e.target.value })}
                          placeholder="Ex: Público Premium"
                        />
                      </div>
                    </div>
                  )}

                  {/* TIME-BASED */}
                  {form.rule_type === "time_based" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Hora Início</Label>
                          <Select value={form.start_hour} onValueChange={v => setForm({ ...form, start_hour: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Fim</Label>
                          <Select value={form.end_hour} onValueChange={v => setForm({ ...form, end_hour: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Dias da Semana</Label>
                        <div className="flex gap-1 flex-wrap">
                          {DAYS_OF_WEEK.map(day => (
                            <Toggle
                              key={day.value}
                              pressed={form.days.includes(day.value)}
                              onPressedChange={() => toggleDay(day.value)}
                              size="sm"
                              variant="outline"
                            >
                              {day.label}
                            </Toggle>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* WORKLOAD */}
                  {form.rule_type === "workload" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Máximo de Leads Ativos por Corretor</Label>
                        <Input
                          type="number"
                          value={form.max_active_leads}
                          onChange={e => setForm({ ...form, max_active_leads: parseInt(e.target.value) || 20 })}
                          min={1}
                          max={1000}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status considerados "ativos" (opcional)</Label>
                        <div className="flex gap-1 flex-wrap">
                          {leadStatuses.map(status => (
                            <Toggle
                              key={status.id}
                              pressed={form.active_status_ids.includes(status.id)}
                              onPressedChange={() => toggleStatus(status.id)}
                              size="sm"
                              variant="outline"
                            >
                              {status.name}
                            </Toggle>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Se nenhum for selecionado, todos os leads atribuídos contam.
                        </p>
                      </div>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Leads serão distribuídos usando Round Robin, mas apenas para corretores 
                          que tenham menos que {form.max_active_leads} leads ativos.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* REGION */}
                  {form.rule_type === "region" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Estado (UF)</Label>
                          <Input
                            value={form.state}
                            onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })}
                            placeholder="SP"
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cidade</Label>
                          <Input
                            value={form.city}
                            onChange={e => setForm({ ...form, city: e.target.value })}
                            placeholder="São Paulo"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Bairro (opcional)</Label>
                        <Input
                          value={form.neighborhood}
                          onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                          placeholder="Jardins"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A regra verifica a localização do imóvel vinculado ao lead.
                      </p>
                    </div>
                  )}

                  {/* CORRETOR DE DESTINO */}
                  {!["round_robin", "workload"].includes(form.rule_type) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label>Corretor de Destino</Label>
                        <Select
                          value={form.target_broker_id}
                          onValueChange={v => setForm({ ...form, target_broker_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o corretor" />
                          </SelectTrigger>
                          <SelectContent>
                            {brokers.map(b => (
                              <SelectItem key={b.user_id} value={b.user_id}>
                                {b.full_name || "Sem nome"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Regras com maior prioridade são avaliadas primeiro. Use 100 para alta, 50 para média, 0 para baixa.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingRule ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhuma regra configurada</h3>
              <p className="text-muted-foreground text-sm">
                Crie regras para distribuir leads automaticamente entre seus corretores
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const typeInfo = getRuleTypeInfo(rule.rule_type);
                const broker = brokers.find(b => b.user_id === rule.target_broker_id);
                const Icon = typeInfo.icon;

                return (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      rule.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${rule.is_active ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`h-5 w-5 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{rule.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="outline" className="shrink-0">{typeInfo.label}</Badge>
                          <span className="truncate">{getConditionLabel(rule)}</span>
                          {broker && <span className="shrink-0">→ {broker.full_name}</span>}
                        </div>
                      </div>
                    </div>

                    {rule.is_default && (
                      <Badge variant="outline" className="shrink-0 border-primary text-primary">
                        Padrão
                      </Badge>
                    )}

                    <Badge variant="secondary" className="shrink-0">
                      P: {rule.priority}
                    </Badge>

                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />

                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(rule.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Round Robin Order Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="w-5 h-5" />
            Configuração Round Robin
          </CardTitle>
          <CardDescription>
            Arraste para reordenar a sequência de distribuição de leads entre corretores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleRoundRobinReorder}>
            <Droppable droppableId="brokers">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {orderedBrokers.map((broker, index) => (
                    <Draggable key={broker.user_id} draggableId={broker.user_id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            snapshot.isDragging ? "bg-accent shadow-lg" : "bg-muted/50"
                          }`}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {index + 1}
                          </div>
                          <span className="font-medium">{broker.full_name || "Sem nome"}</span>
                          {roundRobinConfig && index === ((roundRobinConfig.last_broker_index + 1) % orderedBrokers.length) && (
                            <Badge variant="outline" className="ml-auto">Próximo</Badge>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionRulesManager;
