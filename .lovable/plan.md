

## Plano: Exibir Número Conectado + Seletor de Fontes para Automação

### Objetivo
1. **Exibir o número de telefone** conectado na interface (ao lado de "Conectado desde:")
2. **Adicionar seletor de fontes de leads** na automação de saudação automática (Manual, Meta Ads, Webhook)
3. **Todos ativados por padrão**, com opção de desativar individualmente

---

### Parte 1: Banco de Dados - Nova Coluna

#### Alteração na tabela `whatsapp_automation_rules`

Adicionar um campo JSONB para armazenar quais fontes estão ativadas:

| Coluna | Tipo | Padrão | Descrição |
|--------|------|--------|-----------|
| `trigger_sources` | `jsonb` | `{"manual": true, "meta": true, "webhook": true}` | Define quais origens disparam a automação |

```sql
ALTER TABLE whatsapp_automation_rules 
ADD COLUMN trigger_sources jsonb DEFAULT '{"manual": true, "meta": true, "webhook": true}'::jsonb;
```

---

### Parte 2: Interface - Seletor de Fontes

#### Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Adicionar checkboxes na seção de Saudação Automática para selecionar quando enviar:

```text
┌─────────────────────────────────────────────────────────────┐
│ [Toggle] Saudação Automática                                │
│          Enviar mensagem quando novo lead entrar            │
├─────────────────────────────────────────────────────────────┤
│   Template de Mensagem: [Dropdown]     Delay: [Dropdown]    │
├─────────────────────────────────────────────────────────────┤
│   Enviar para leads de:                                     │
│   [✓] Cadastro Manual                                       │
│   [✓] Meta Ads (Facebook/Instagram)                         │
│   [✓] Webhook                                               │
└─────────────────────────────────────────────────────────────┘
```

Mudanças no código:

1. Atualizar interface `AutomationRule`:
```typescript
interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  template_id: string | null;
  is_active: boolean;
  delay_seconds: number;
  trigger_sources: {
    manual: boolean;
    meta: boolean;
    webhook: boolean;
  };
}
```

2. Adicionar função para atualizar fontes:
```typescript
const updateRuleSources = async (ruleId: string, sources: object) => {
  await supabase
    .from('whatsapp_automation_rules')
    .update({ trigger_sources: sources })
    .eq('id', ruleId);
  fetchAutomationRules();
};
```

3. Renderizar checkboxes na UI (dentro da área expandida quando `is_active = true`):
```tsx
<div className="space-y-2">
  <Label>Enviar para leads de:</Label>
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Checkbox 
        checked={newLeadRule.trigger_sources?.manual !== false}
        onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
          ...newLeadRule.trigger_sources,
          manual: checked
        })}
      />
      <Label className="font-normal">Cadastro Manual</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox 
        checked={newLeadRule.trigger_sources?.meta !== false}
        onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
          ...newLeadRule.trigger_sources,
          meta: checked
        })}
      />
      <Label className="font-normal">Meta Ads (Facebook/Instagram)</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox 
        checked={newLeadRule.trigger_sources?.webhook !== false}
        onCheckedChange={(checked) => updateRuleSources(newLeadRule.id, {
          ...newLeadRule.trigger_sources,
          webhook: checked
        })}
      />
      <Label className="font-normal">Webhook</Label>
    </div>
  </div>
</div>
```

---

### Parte 3: Backend - Verificar Fonte antes de Agendar

#### Arquivo: `supabase/functions/webhook-leads/index.ts`

Após criar o lead, verificar se `trigger_sources.webhook === true`:

```typescript
// Check for WhatsApp automation rule (new_lead)
try {
  const { data: automationRule } = await supabase
    .from('whatsapp_automation_rules')
    .select('*')
    .eq('account_id', accountId)
    .eq('trigger_type', 'new_lead')
    .eq('is_active', true)
    .single()

  // Verificar se webhook está ativado nas fontes
  const sources = automationRule?.trigger_sources || { webhook: true }
  if (automationRule?.template_id && sources.webhook !== false) {
    // Check if WhatsApp is connected
    const { data: whatsappSession } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .single()

    if (whatsappSession) {
      const scheduledFor = new Date(Date.now() + (automationRule.delay_seconds * 1000))
      
      await supabase.from('whatsapp_message_queue').insert({
        account_id: accountId,
        lead_id: lead.id,
        template_id: automationRule.template_id,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      })
      
      console.log(`WhatsApp greeting scheduled for webhook lead ${lead.id}`)
    }
  }
} catch (e) {
  console.log('WhatsApp automation check error:', e)
}
```

#### Arquivo: `supabase/functions/meta-webhook/index.ts`

Mesma lógica, mas verificando `trigger_sources.meta`:

```typescript
// Check for WhatsApp automation
try {
  const { data: automationRule } = await supabase
    .from('whatsapp_automation_rules')
    .select('*')
    .eq('account_id', cfg.account_id)
    .eq('trigger_type', 'new_lead')
    .eq('is_active', true)
    .single()

  const sources = automationRule?.trigger_sources || { meta: true }
  if (automationRule?.template_id && sources.meta !== false) {
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('account_id', cfg.account_id)
      .eq('status', 'connected')
      .single()

    if (session) {
      const scheduledFor = new Date(Date.now() + (automationRule.delay_seconds * 1000))
      await supabase.from('whatsapp_message_queue').insert({
        account_id: cfg.account_id,
        lead_id: newLead.id,
        template_id: automationRule.template_id,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      })
      console.log(`WhatsApp scheduled for Meta lead ${newLead.id}`)
    }
  }
} catch {}
```

#### Para Leads Manuais (novo: trigger na criação)

Para leads criados manualmente, precisamos adicionar um trigger na aplicação React. Quando um lead é criado manualmente na UI, verificar se `trigger_sources.manual === true` e agendar a mensagem.

Isso pode ser feito:
- **Opção A**: Database trigger (mais robusto)
- **Opção B**: No frontend após inserção (mais simples)

Recomendo **Opção A** com um database trigger que chama uma edge function quando um lead é criado com `origem` diferente de 'Facebook', 'Instagram', 'Webhook'.

---

### Parte 4: Capturar Número de Telefone Conectado

#### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

Quando receber `connection.update` com `state === 'open'`, buscar o número:

```typescript
if (state === 'open') {
  newStatus = 'connected'
  
  // Fetch instance info to get phone number
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
  
  try {
    const instanceResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instance}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const instanceData = await instanceResponse.json()
    
    // Extract phone from owner field (format: 5516981057418@s.whatsapp.net)
    const owner = instanceData[0]?.instance?.owner
    if (owner) {
      const phoneRaw = owner.split('@')[0]
      // Format: +55 (16) 98105-7418
      const countryCode = phoneRaw.slice(0, 2)
      const areaCode = phoneRaw.slice(2, 4)
      const firstPart = phoneRaw.slice(4, 9)
      const secondPart = phoneRaw.slice(9)
      const formatted = `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
      
      await supabase
        .from('whatsapp_sessions')
        .update({ 
          phone_number: formatted,
          status: newStatus,
          connected_at: new Date().toISOString()
        })
        .eq('id', session.id)
        
      console.log(`[whatsapp-webhook] Phone number saved: ${formatted}`)
    }
  } catch (e) {
    console.log('[whatsapp-webhook] Could not fetch phone number:', e)
  }
}
```

---

### Parte 5: Processador de Fila (Cron)

#### Novo arquivo: `supabase/functions/process-whatsapp-queue/index.ts`

Esta função processa a fila de mensagens e envia as pendentes:

```typescript
// 1. Buscar mensagens pendentes com scheduled_for <= now()
// 2. Para cada mensagem:
//    a. Buscar template e lead
//    b. Substituir variáveis ({nome}, {imovel}, etc)
//    c. Chamar whatsapp-send
//    d. Atualizar status para 'sent' ou 'failed'
```

---

### Resumo das Alterações

| Componente | Arquivo | Mudança |
|------------|---------|---------|
| Banco | Migration | Adicionar coluna `trigger_sources` em `whatsapp_automation_rules` |
| Frontend | `WhatsAppIntegrationSettings.tsx` | Adicionar checkboxes para selecionar fontes |
| Backend | `whatsapp-webhook/index.ts` | Capturar número de telefone quando conectar |
| Backend | `webhook-leads/index.ts` | Verificar fonte e agendar mensagem |
| Backend | `meta-webhook/index.ts` | Verificar fonte e agendar mensagem |
| Backend | `process-whatsapp-queue/index.ts` | **NOVO** - Processar fila de mensagens |
| Config | `supabase/config.toml` | Adicionar nova função |

### Fluxo Final

```text
Lead criado (Manual/Meta/Webhook)
         ↓
Verificar regra new_lead ativa
         ↓
Fonte está ativada? (manual/meta/webhook)
         ↓
    Sim → WhatsApp conectado? → Sim → Inserir na fila
         ↓
Cron processa fila
         ↓
whatsapp-send envia mensagem
```

### Comportamento Padrão

- **Por padrão**: Todas as 3 fontes (Manual, Meta, Webhook) vêm ativadas
- **Usuário pode**: Desativar qualquer combinação conforme preferir
- **Interface clara**: Checkboxes mostram exatamente o que está ativado

