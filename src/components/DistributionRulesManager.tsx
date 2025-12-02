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
import { Plus, Edit2, Trash2, Shuffle, Building2, Globe, Target, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DistributionRule {
  id: string;
  name: string;
  rule_type: string;
  conditions: Record<string, string>;
  target_broker_id: string | null;
  priority: number;
  is_active: boolean;
}

interface Broker {
  user_id: string;
  full_name: string | null;
}

interface Property {
  id: string;
  title: string;
}

const RULE_TYPES = [
  { value: "round_robin", label: "Round Robin", icon: Shuffle, description: "Distribui leads igualmente entre corretores" },
  { value: "origin", label: "Por Origem", icon: Globe, description: "Direciona leads baseado na origem" },
  { value: "interest", label: "Por Interesse", icon: Target, description: "Direciona leads baseado no interesse" },
  { value: "property", label: "Por Imóvel", icon: Building2, description: "Direciona leads interessados em imóvel específico" },
];

const DistributionRulesManager = () => {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DistributionRule[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DistributionRule | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    rule_type: "round_robin",
    condition_key: "",
    condition_value: "",
    target_broker_id: "",
    priority: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, brokersRes, propertiesRes] = await Promise.all([
        supabase.from("distribution_rules").select("*").order("priority", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("properties").select("id, title").eq("status", "disponivel"),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (propertiesRes.error) throw propertiesRes.error;

      setRules(rulesRes.data?.map(r => ({
        ...r,
        conditions: r.conditions as Record<string, string>
      })) || []);
      setBrokers(brokersRes.data || []);
      setProperties(propertiesRes.data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome da regra é obrigatório." });
      return;
    }

    if (form.rule_type !== "round_robin" && !form.target_broker_id) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um corretor de destino." });
      return;
    }

    try {
      const { data: accountData, error: accountError } = await supabase.rpc('get_user_account_id');
      if (accountError) throw accountError;

      const conditions: Record<string, string> = {};
      if (form.rule_type !== "round_robin" && form.condition_key && form.condition_value) {
        conditions[form.condition_key] = form.condition_value;
      }

      const ruleData = {
        name: form.name,
        rule_type: form.rule_type,
        conditions,
        target_broker_id: form.rule_type === "round_robin" ? null : form.target_broker_id || null,
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
    });
  };

  const openEditDialog = (rule: DistributionRule) => {
    setEditingRule(rule);
    const conditionKeys = Object.keys(rule.conditions);
    setForm({
      name: rule.name,
      rule_type: rule.rule_type,
      condition_key: conditionKeys[0] || "",
      condition_value: conditionKeys[0] ? rule.conditions[conditionKeys[0]] : "",
      target_broker_id: rule.target_broker_id || "",
      priority: rule.priority,
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

  const getConditionLabel = (key: string, value: string) => {
    if (key === "property_id") {
      const property = properties.find(p => p.id === value);
      return property?.title || value;
    }
    return value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Regras de Distribuição</CardTitle>
            <CardDescription>
              Configure como os leads são automaticamente distribuídos entre corretores
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                    placeholder="Ex: Leads Instagram para João"
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

                {form.rule_type !== "round_robin" && (
                  <>
                    <div className="space-y-2">
                      <Label>Condição</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {form.rule_type === "origin" && (
                          <Input
                            value={form.condition_value}
                            onChange={e => setForm({ ...form, condition_key: "origem", condition_value: e.target.value })}
                            placeholder="Ex: instagram"
                          />
                        )}
                        {form.rule_type === "interest" && (
                          <Input
                            value={form.condition_value}
                            onChange={e => setForm({ ...form, condition_key: "interesse", condition_value: e.target.value })}
                            placeholder="Ex: Apartamento Centro"
                          />
                        )}
                        {form.rule_type === "property" && (
                          <Select
                            value={form.condition_value}
                            onValueChange={v => setForm({ ...form, condition_key: "property_id", condition_value: v })}
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
                        )}
                      </div>
                    </div>

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

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Regras com maior prioridade são avaliadas primeiro
                  </p>
                </div>

                <div className="flex justify-end gap-2">
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
          <div className="space-y-4">
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
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${rule.is_active ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{typeInfo.label}</Badge>
                        {Object.entries(rule.conditions).map(([key, value]) => (
                          <span key={key}>
                            {key}: {getConditionLabel(key, value)}
                          </span>
                        ))}
                        {broker && <span>→ {broker.full_name}</span>}
                      </div>
                    </div>
                  </div>

                  <Badge variant="secondary">
                    Prioridade: {rule.priority}
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
  );
};

export default DistributionRulesManager;
