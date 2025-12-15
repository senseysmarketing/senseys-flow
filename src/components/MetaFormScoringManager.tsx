import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Settings2, Thermometer, Save, RefreshCw, Globe, Facebook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FormConfig {
  id: string;
  form_id: string;
  form_name: string | null;
  hot_threshold: number;
  warm_threshold: number;
  reference_field_name: string | null;
  is_configured: boolean;
  source_type: string;
}

interface ScoringRule {
  id: string;
  form_config_id: string;
  question_name: string;
  question_label: string | null;
  answer_value: string;
  score: number;
}

interface GroupedRules {
  [questionName: string]: {
    label: string;
    answers: ScoringRule[];
  };
}

const MetaFormScoringManager = () => {
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>([]);
  const [scoringRules, setScoringRules] = useState<Record<string, ScoringRule[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<FormConfig>>>({});
  const [editedRules, setEditedRules] = useState<Record<string, number>>({});
  const [updateExistingLeads, setUpdateExistingLeads] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch form configs
      const { data: configs, error: configError } = await supabase
        .from("meta_form_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (configError) throw configError;
      
      // Add default source_type for backwards compatibility
      const configsWithType = (configs || []).map(c => ({
        ...c,
        source_type: c.source_type || 'meta'
      }));
      
      setFormConfigs(configsWithType);

      // Fetch scoring rules for each config
      const rulesMap: Record<string, ScoringRule[]> = {};
      for (const config of configsWithType) {
        const { data: rules, error: rulesError } = await supabase
          .from("meta_form_scoring_rules")
          .select("*")
          .eq("form_config_id", config.id)
          .order("question_name");

        if (!rulesError && rules) {
          rulesMap[config.id] = rules;
        }
      }
      setScoringRules(rulesMap);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as configurações de formulários.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Campos de dados básicos do lead que não devem aparecer na qualificação
  const EXCLUDED_FIELD_NAMES = [
    'full_name', 'nome', 'name',
    'email', 'e-mail',
    'phone_number', 'telefone', 'phone', 'celular', 'whatsapp'
  ];

  const groupRulesByQuestion = (rules: ScoringRule[]): GroupedRules => {
    const grouped: GroupedRules = {};
    for (const rule of rules) {
      // Filtrar campos de dados básicos do lead
      if (EXCLUDED_FIELD_NAMES.includes(rule.question_name.toLowerCase())) {
        continue;
      }
      if (!grouped[rule.question_name]) {
        grouped[rule.question_name] = {
          label: rule.question_label || rule.question_name,
          answers: [],
        };
      }
      grouped[rule.question_name].answers.push(rule);
    }
    return grouped;
  };

  const handleConfigChange = (configId: string, field: keyof FormConfig, value: any) => {
    setEditedConfigs((prev) => ({
      ...prev,
      [configId]: {
        ...prev[configId],
        [field]: value,
      },
    }));
  };

  const handleRuleScoreChange = (ruleId: string, score: number) => {
    setEditedRules((prev) => ({
      ...prev,
      [ruleId]: score,
    }));
  };

  const saveConfig = async (configId: string) => {
    setSaving(true);
    try {
      const updates = editedConfigs[configId];
      if (updates) {
        const { error } = await supabase
          .from("meta_form_configs")
          .update({
            ...updates,
            is_configured: true,
          })
          .eq("id", configId);

        if (error) throw error;
      }

      // Save edited rules
      const rulesToUpdate = Object.entries(editedRules).filter(([ruleId]) => {
        const rule = scoringRules[configId]?.find((r) => r.id === ruleId);
        return rule !== undefined;
      });

      for (const [ruleId, score] of rulesToUpdate) {
        const { error } = await supabase
          .from("meta_form_scoring_rules")
          .update({ score })
          .eq("id", ruleId);

        if (error) throw error;
      }

      // Recalculate existing leads if option is enabled (default: true)
      const shouldRecalculate = updateExistingLeads[configId] !== false;
      let recalculatedCount = 0;

      if (shouldRecalculate) {
        setRecalculating(true);
        try {
          const { data, error: recalcError } = await supabase.functions.invoke(
            "recalculate-lead-temperatures",
            { body: { form_config_id: configId } }
          );

          if (recalcError) {
            console.error("Erro ao recalcular temperaturas:", recalcError);
          } else if (data?.stats) {
            recalculatedCount = data.stats.updated || 0;
          }
        } catch (recalcErr) {
          console.error("Erro ao recalcular:", recalcErr);
        } finally {
          setRecalculating(false);
        }
      }

      toast({
        title: "Sucesso",
        description: shouldRecalculate && recalculatedCount > 0
          ? `Configuração salva! ${recalculatedCount} lead(s) atualizado(s).`
          : "Configuração salva com sucesso!",
      });

      // Clear edited state for this config
      setEditedConfigs((prev) => {
        const newState = { ...prev };
        delete newState[configId];
        return newState;
      });

      // Clear edited rules for this config
      const configRuleIds = scoringRules[configId]?.map((r) => r.id) || [];
      setEditedRules((prev) => {
        const newState = { ...prev };
        for (const ruleId of configRuleIds) {
          delete newState[ruleId];
        }
        return newState;
      });

      fetchData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
      });
    } finally {
      setSaving(false);
      setRecalculating(false);
    }
  };

  const getTemperaturePreview = (config: FormConfig, rules: ScoringRule[]) => {
    const editedConfig = editedConfigs[config.id];
    const hotThreshold = editedConfig?.hot_threshold ?? config.hot_threshold;
    const warmThreshold = editedConfig?.warm_threshold ?? config.warm_threshold;

    // Calculate sample score with current rules
    let sampleScore = 0;
    for (const rule of rules) {
      const editedScore = editedRules[rule.id];
      sampleScore += editedScore ?? rule.score;
    }

    return { hotThreshold, warmThreshold, sampleScore };
  };

  const getSourceIcon = (sourceType: string) => {
    if (sourceType === 'webhook') {
      return <Globe className="h-4 w-4 text-blue-400" />;
    }
    return <Facebook className="h-4 w-4 text-blue-500" />;
  };

  const getSourceLabel = (sourceType: string) => {
    return sourceType === 'webhook' ? 'Webhook' : 'Meta';
  };

  const filteredConfigs = formConfigs.filter(config => {
    if (activeTab === 'all') return true;
    return config.source_type === activeTab;
  });

  const metaCount = formConfigs.filter(c => c.source_type === 'meta').length;
  const webhookCount = formConfigs.filter(c => c.source_type === 'webhook').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (formConfigs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum formulário detectado</p>
            <p className="text-sm">
              Quando leads chegarem via Meta Lead Ads ou Webhook com <code className="bg-muted px-1 rounded">form_id</code> e <code className="bg-muted px-1 rounded">form_fields</code>, 
              os formulários serão detectados automaticamente e aparecerão aqui para configuração.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderFormConfig = (config: FormConfig) => {
    const rules = scoringRules[config.id] || [];
    const groupedRules = groupRulesByQuestion(rules);
    const editedConfig = editedConfigs[config.id];
    const { hotThreshold, warmThreshold } = getTemperaturePreview(config, rules);
    const hasChanges = !!editedConfig || rules.some((r) => editedRules[r.id] !== undefined);

    return (
      <AccordionItem key={config.id} value={config.id} className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {config.form_name || `Formulário ${config.form_id.substring(0, 8)}...`}
                </span>
                <Badge variant="outline" className="text-xs">
                  {getSourceIcon(config.source_type)}
                  <span className="ml-1">{getSourceLabel(config.source_type)}</span>
                </Badge>
                {config.is_configured ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {Object.keys(groupedRules).length} perguntas detectadas
              </p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="pt-4 pb-6 space-y-6">
          {/* Thresholds Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-red-500" />
                Limiar para Lead Quente
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[editedConfig?.hot_threshold ?? config.hot_threshold]}
                  onValueChange={([value]) => handleConfigChange(config.id, "hot_threshold", value)}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-lg font-bold text-red-500 w-8">
                  {editedConfig?.hot_threshold ?? config.hot_threshold}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Score ≥ {editedConfig?.hot_threshold ?? config.hot_threshold} = Lead Quente
              </p>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-yellow-500" />
                Limiar para Lead Morno
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[editedConfig?.warm_threshold ?? config.warm_threshold]}
                  onValueChange={([value]) => handleConfigChange(config.id, "warm_threshold", value)}
                  min={-5}
                  max={hotThreshold - 1}
                  step={1}
                  className="flex-1"
                />
                <span className="text-lg font-bold text-yellow-500 w-8">
                  {editedConfig?.warm_threshold ?? config.warm_threshold}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Score ≥ {editedConfig?.warm_threshold ?? config.warm_threshold} e &lt; {hotThreshold} = Lead Morno
              </p>
            </div>
          </div>

          {/* Reference Field Configuration */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <Label>Campo de Código de Referência (para vincular a imóveis)</Label>
            <Select
              value={editedConfig?.reference_field_name ?? config.reference_field_name ?? "none"}
              onValueChange={(value) =>
                handleConfigChange(config.id, "reference_field_name", value === "none" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um campo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {Object.keys(groupedRules).map((questionName) => (
                  <SelectItem key={questionName} value={questionName}>
                    {groupedRules[questionName].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se selecionado, o valor deste campo será usado para vincular o lead a um imóvel com código de referência correspondente.
            </p>
          </div>

          {/* Scoring Rules per Question */}
          <div className="space-y-4">
            <Label className="text-base">Pontuação por Resposta</Label>
            
            {Object.keys(groupedRules).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhuma pergunta de qualificação detectada. As perguntas aparecerão quando leads com respostas chegarem.
              </p>
            ) : (
              Object.entries(groupedRules).map(([questionName, { label, answers }]) => (
                <div key={questionName} className="border rounded-lg p-4 space-y-3">
                  <p className="font-medium text-sm">{label}</p>
                  <div className="grid gap-2">
                    {answers.map((rule) => {
                      const currentScore = editedRules[rule.id] ?? rule.score;
                      return (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between gap-4 p-2 bg-muted/20 rounded"
                        >
                          <span className="text-sm flex-1 truncate" title={rule.answer_value}>
                            "{rule.answer_value}"
                          </span>
                          <Select
                            value={String(currentScore)}
                            onValueChange={(value) => handleRuleScoreChange(rule.id, parseInt(value))}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">
                                <span className="text-green-500">Muito positivo (+2)</span>
                              </SelectItem>
                              <SelectItem value="1">
                                <span className="text-green-400">Positivo (+1)</span>
                              </SelectItem>
                              <SelectItem value="0">
                                <span className="text-muted-foreground">Neutro (0)</span>
                              </SelectItem>
                              <SelectItem value="-1">
                                <span className="text-red-400">Negativo (-1)</span>
                              </SelectItem>
                              <SelectItem value="-2">
                                <span className="text-red-500">Muito negativo (-2)</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Temperature Preview */}
          <div className="p-4 border-2 border-dashed rounded-lg space-y-2">
            <p className="text-sm font-medium">Legenda de Temperatura:</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Quente: Score ≥ {hotThreshold}</span>
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Morno: Score ≥ {warmThreshold} e &lt; {hotThreshold}</span>
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Frio: Score &lt; {warmThreshold}</span>
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id={`update-leads-${config.id}`}
                checked={updateExistingLeads[config.id] !== false}
                onCheckedChange={(checked) =>
                  setUpdateExistingLeads((prev) => ({ ...prev, [config.id]: checked }))
                }
              />
              <Label htmlFor={`update-leads-${config.id}`} className="text-sm cursor-pointer">
                Atualizar leads existentes
              </Label>
            </div>
            <Button onClick={() => saveConfig(config.id)} disabled={saving || recalculating || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {recalculating ? "Recalculando..." : saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">
              Todos ({formConfigs.length})
            </TabsTrigger>
            <TabsTrigger value="meta" className="flex items-center gap-1">
              <Facebook className="h-3 w-3" />
              Meta ({metaCount})
            </TabsTrigger>
            <TabsTrigger value="webhook" className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Webhook ({webhookCount})
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {filteredConfigs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum formulário {activeTab === 'meta' ? 'Meta' : 'Webhook'} detectado ainda.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {filteredConfigs.map(renderFormConfig)}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetaFormScoringManager;
