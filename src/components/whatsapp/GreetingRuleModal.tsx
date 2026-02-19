import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface WhatsAppTemplate {
  id: string;
  name: string;
}

interface Property {
  id: string;
  title: string;
  reference_code: string | null;
}

interface GreetingRule {
  id?: string;
  name: string;
  priority: number;
  is_active: boolean;
  template_id: string | null;
  delay_seconds: number;
  condition_type: string;
  condition_property_id: string | null;
  condition_price_min: number | null;
  condition_price_max: number | null;
  condition_property_type: string | null;
  condition_transaction_type: string | null;
  condition_campaign: string | null;
  condition_origin: string | null;
}

interface GreetingRuleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  templates: WhatsAppTemplate[];
  // Pre-fill for property-specific rules
  prefillPropertyId?: string;
  editRule?: GreetingRule | null;
}

const CONDITION_TYPES = [
  { value: 'property', label: '🏠 Imóvel Específico' },
  { value: 'price_range', label: '💰 Faixa de Valor' },
  { value: 'property_type', label: '🏗️ Tipo de Imóvel' },
  { value: 'transaction_type', label: '🔑 Tipo de Transação' },
  { value: 'campaign', label: '📣 Campanha / Formulário' },
  { value: 'origin', label: '📍 Origem do Lead' },
];

const PROPERTY_TYPES = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'rural', label: 'Rural' },
];

const TRANSACTION_TYPES = [
  { value: 'sale', label: 'Venda' },
  { value: 'rent', label: 'Aluguel' },
];

const ORIGIN_TYPES = [
  { value: 'manual', label: 'Cadastro Manual' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'olx', label: 'Grupo OLX' },
];

const DELAY_OPTIONS = [
  { value: 0, label: 'Imediato' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 300, label: '5 minutos' },
  { value: 600, label: '10 minutos' },
];

export function GreetingRuleModal({ open, onClose, onSaved, templates, prefillPropertyId, editRule }: GreetingRuleModalProps) {
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<GreetingRule>({
    name: '',
    priority: 0,
    is_active: true,
    template_id: null,
    delay_seconds: 0,
    condition_type: prefillPropertyId ? 'property' : 'property',
    condition_property_id: prefillPropertyId || null,
    condition_price_min: null,
    condition_price_max: null,
    condition_property_type: null,
    condition_transaction_type: null,
    condition_campaign: null,
    condition_origin: null,
  });

  useEffect(() => {
    if (open) {
      if (editRule) {
        setForm({ ...editRule });
      } else {
        setForm({
          name: prefillPropertyId ? 'Saudação por Imóvel' : '',
          priority: 0,
          is_active: true,
          template_id: templates[0]?.id || null,
          delay_seconds: 0,
          condition_type: prefillPropertyId ? 'property' : 'property',
          condition_property_id: prefillPropertyId || null,
          condition_price_min: null,
          condition_price_max: null,
          condition_property_type: null,
          condition_transaction_type: null,
          condition_campaign: null,
          condition_origin: null,
        });
      }
      fetchProperties();
    }
  }, [open, prefillPropertyId, editRule]);

  const fetchProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('id, title, reference_code')
      .order('title');
    setProperties(data || []);
  };

  const setField = <K extends keyof GreetingRule>(key: K, value: GreetingRule[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleConditionTypeChange = (type: string) => {
    setForm(prev => ({
      ...prev,
      condition_type: type,
      condition_property_id: null,
      condition_price_min: null,
      condition_price_max: null,
      condition_property_type: null,
      condition_transaction_type: null,
      condition_campaign: null,
      condition_origin: null,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Informe um nome para a regra.' });
      return;
    }
    if (!form.template_id) {
      toast({ variant: 'destructive', title: 'Template obrigatório', description: 'Selecione um template de mensagem.' });
      return;
    }

    setSaving(true);
    try {
      const { data: accountData } = await supabase.rpc('get_user_account_id');

      const payload = {
        account_id: accountData,
        name: form.name,
        priority: form.priority,
        is_active: form.is_active,
        template_id: form.template_id,
        delay_seconds: form.delay_seconds,
        condition_type: form.condition_type,
        condition_property_id: form.condition_type === 'property' ? form.condition_property_id : null,
        condition_price_min: form.condition_type === 'price_range' ? form.condition_price_min : null,
        condition_price_max: form.condition_type === 'price_range' ? form.condition_price_max : null,
        condition_property_type: form.condition_type === 'property_type' ? form.condition_property_type : null,
        condition_transaction_type: form.condition_type === 'transaction_type' ? form.condition_transaction_type : null,
        condition_campaign: form.condition_type === 'campaign' ? form.condition_campaign : null,
        condition_origin: form.condition_type === 'origin' ? form.condition_origin : null,
      };

      if (editRule?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('whatsapp_greeting_rules' as any) as any)
          .update(payload)
          .eq('id', editRule.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('whatsapp_greeting_rules' as any) as any).insert(payload);
      }

      toast({ title: editRule ? 'Regra atualizada' : 'Regra criada', description: 'Regra de saudação salva com sucesso.' });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível salvar a regra.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editRule ? 'Editar Regra de Saudação' : 'Nova Regra de Saudação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome da regra</Label>
            <Input
              placeholder="Ex: Saudação para Apartamentos de Alto Padrão"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>

          {/* Condition Type */}
          <div className="space-y-2">
            <Label>Tipo de condição</Label>
            <Select value={form.condition_type} onValueChange={handleConditionTypeChange} disabled={!!prefillPropertyId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_TYPES.map(ct => (
                  <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition-specific fields */}
          {form.condition_type === 'property' && (
            <div className="space-y-2">
              <Label>Imóvel</Label>
              <Select
                value={form.condition_property_id || ''}
                onValueChange={v => setField('condition_property_id', v)}
                disabled={!!prefillPropertyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o imóvel" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}{p.reference_code ? ` (${p.reference_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.condition_type === 'price_range' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor mínimo (R$)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.condition_price_min ?? ''}
                  onChange={e => setField('condition_price_min', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor máximo (R$)</Label>
                <Input
                  type="number"
                  placeholder="1.000.000"
                  value={form.condition_price_max ?? ''}
                  onChange={e => setField('condition_price_max', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
          )}

          {form.condition_type === 'property_type' && (
            <div className="space-y-2">
              <Label>Tipo de imóvel</Label>
              <Select value={form.condition_property_type || ''} onValueChange={v => setField('condition_property_type', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map(pt => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.condition_type === 'transaction_type' && (
            <div className="space-y-2">
              <Label>Tipo de transação</Label>
              <Select value={form.condition_transaction_type || ''} onValueChange={v => setField('condition_transaction_type', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map(tt => (
                    <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.condition_type === 'campaign' && (
            <div className="space-y-2">
              <Label>Nome da campanha / formulário (match parcial)</Label>
              <Input
                placeholder="Ex: Black Friday, Campanha Julho..."
                value={form.condition_campaign || ''}
                onChange={e => setField('condition_campaign', e.target.value)}
              />
            </div>
          )}

          {form.condition_type === 'origin' && (
            <div className="space-y-2">
              <Label>Origem do lead</Label>
              <Select value={form.condition_origin || ''} onValueChange={v => setField('condition_origin', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                <SelectContent>
                  {ORIGIN_TYPES.map(ot => (
                    <SelectItem key={ot.value} value={ot.value}>{ot.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template & Delay */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Template de mensagem</Label>
              <Select value={form.template_id || ''} onValueChange={v => setField('template_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Delay</Label>
              <Select value={String(form.delay_seconds)} onValueChange={v => setField('delay_seconds', parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELAY_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioridade <span className="text-muted-foreground font-normal">(menor = maior prioridade)</span></Label>
            <Input
              type="number"
              min={0}
              value={form.priority}
              onChange={e => setField('priority', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editRule ? 'Salvar alterações' : 'Criar regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
