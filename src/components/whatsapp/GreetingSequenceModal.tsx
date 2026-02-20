import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown, ArrowRight, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface WhatsAppTemplate {
  id: string;
  name: string;
}

interface SequenceStep {
  id?: string;
  name: string;
  template_id: string;
  delay_seconds: number;
  position: number;
  is_active: boolean;
}

interface GreetingSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  templates: WhatsAppTemplate[];
  // Either automation_rule_id (default rule) or greeting_rule_id (conditional rule)
  automationRuleId?: string | null;
  greetingRuleId?: string | null;
  ruleLabel?: string;
}

const MAX_STEPS = 5;

const DELAY_OPTIONS = [
  { value: 0, label: 'Imediato (após anterior)' },
  { value: 3, label: '3 segundos' },
  { value: 5, label: '5 segundos' },
  { value: 10, label: '10 segundos' },
  { value: 15, label: '15 segundos' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 120, label: '2 minutos' },
  { value: 300, label: '5 minutos' },
];

function formatDelay(seconds: number): string {
  if (seconds === 0) return 'imediato';
  if (seconds < 60) return `+${seconds}s`;
  return `+${Math.round(seconds / 60)}min`;
}

export function GreetingSequenceModal({
  open,
  onClose,
  onSaved,
  templates,
  automationRuleId,
  greetingRuleId,
  ruleLabel,
}: GreetingSequenceModalProps) {
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSteps();
    }
  }, [open, automationRuleId, greetingRuleId]);

  const fetchSteps = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('whatsapp_greeting_sequence_steps' as any) as any)
        .select('*')
        .order('position');

      if (automationRuleId) {
        query = query.eq('automation_rule_id', automationRuleId);
      } else if (greetingRuleId) {
        query = query.eq('greeting_rule_id', greetingRuleId);
      }

      const { data } = await query;
      setSteps((data || []) as SequenceStep[]);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    const newStep: SequenceStep = {
      name: `Mensagem ${steps.length + 1}`,
      template_id: templates[0]?.id || '',
      delay_seconds: steps.length === 0 ? 0 : 5,
      position: steps.length + 1,
      is_active: true,
    };
    setSteps(prev => [...prev, newStep]);
  };

  const removeStep = (index: number) => {
    setSteps(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, i) => ({ ...s, position: i + 1 }));
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setSteps(prev => {
      const arr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= arr.length) return arr;
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return arr.map((s, i) => ({ ...s, position: i + 1 }));
    });
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: string | number | boolean) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (steps.length === 0) {
      // Delete all existing steps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let deleteQuery = (supabase.from('whatsapp_greeting_sequence_steps' as any) as any).delete();
      if (automationRuleId) deleteQuery = deleteQuery.eq('automation_rule_id', automationRuleId);
      else if (greetingRuleId) deleteQuery = deleteQuery.eq('greeting_rule_id', greetingRuleId);
      await deleteQuery;
      toast({ title: 'Sequência limpa', description: 'As etapas foram removidas. A regra enviará uma única mensagem.' });
      onSaved();
      onClose();
      return;
    }

    // Validate
    for (const step of steps) {
      if (!step.template_id) {
        toast({ variant: 'destructive', title: 'Template obrigatório', description: 'Selecione um template para cada mensagem.' });
        return;
      }
    }

    setSaving(true);
    try {
      const { data: accountData } = await supabase.rpc('get_user_account_id');

      // Delete all existing steps for this rule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let deleteQuery = (supabase.from('whatsapp_greeting_sequence_steps' as any) as any).delete();
      if (automationRuleId) deleteQuery = deleteQuery.eq('automation_rule_id', automationRuleId);
      else if (greetingRuleId) deleteQuery = deleteQuery.eq('greeting_rule_id', greetingRuleId);
      await deleteQuery;

      // Re-insert all steps
      const inserts = steps.map((step, i) => ({
        account_id: accountData,
        automation_rule_id: automationRuleId || null,
        greeting_rule_id: greetingRuleId || null,
        template_id: step.template_id,
        name: step.name || `Mensagem ${i + 1}`,
        position: i + 1,
        delay_seconds: step.delay_seconds,
        is_active: true,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('whatsapp_greeting_sequence_steps' as any) as any).insert(inserts);

      if (error) throw error;

      toast({ title: 'Sequência salva!', description: `${steps.length} mensagem${steps.length > 1 ? 's' : ''} configurada${steps.length > 1 ? 's' : ''} na sequência.` });
      onSaved();
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Sequência de Mensagens
          </DialogTitle>
          {ruleLabel && (
            <p className="text-sm text-muted-foreground">
              Regra: <span className="font-medium text-foreground">{ruleLabel}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
            Configure múltiplas mensagens que serão enviadas em sequência. Deixe vazio para enviar apenas o template padrão da regra.
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Visual flow preview */}
              {steps.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap bg-muted/30 rounded-lg p-3">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs font-normal gap-1 shrink-0">
                        <span className="font-medium">Msg {i + 1}</span>
                        <span className="text-muted-foreground">
                          {templates.find(t => t.id === step.template_id)?.name || '–'}
                        </span>
                      </Badge>
                      {i < steps.length - 1 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-xs">{formatDelay(steps[i + 1].delay_seconds)}</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Steps list */}
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-3 bg-muted/10">
                    {/* Step header */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {index + 1}
                      </div>
                      <Input
                        className="flex-1 h-8 text-sm"
                        placeholder={`Mensagem ${index + 1}`}
                        value={step.name}
                        onChange={e => updateStep(index, 'name', e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Template + Delay */}
                    <div className="grid grid-cols-2 gap-3 pl-9">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Template</Label>
                        <Select
                          value={step.template_id}
                          onValueChange={v => updateStep(index, 'template_id', v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {index === 0 ? 'Delay inicial' : 'Delay após anterior'}
                        </Label>
                        <Select
                          value={String(step.delay_seconds)}
                          onValueChange={v => updateStep(index, 'delay_seconds', parseInt(v))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DELAY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add step button */}
              {steps.length < MAX_STEPS ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addStep}
                  disabled={templates.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Mensagem {steps.length > 0 ? `(${steps.length}/${MAX_STEPS})` : ''}
                </Button>
              ) : (
                <p className="text-xs text-center text-muted-foreground">Máximo de {MAX_STEPS} mensagens por sequência atingido.</p>
              )}

              {steps.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                  <MessageSquare className="h-5 w-5 mx-auto mb-2 opacity-40" />
                  Nenhuma etapa configurada.<br />
                  <span className="text-xs">Quando vazio, a regra enviará apenas o template padrão.</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Sequência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
