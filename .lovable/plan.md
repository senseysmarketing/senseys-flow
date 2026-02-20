
## Sequência de Mensagens na Saudação Automática

### O que o usuário quer

Ao invés de enviar apenas **uma** mensagem de saudação, o sistema deve poder enviar **2 ou 3 mensagens em sequência** (como no print), cada uma com seu próprio intervalo de delay — dando a impressão de uma conversa natural e humanizada.

---

### Análise do Sistema Atual

**Como funciona hoje:**
1. Lead chega → `webhook-leads` avalia regras condicionais → encontra o template correto
2. Insere **1 registro** na `whatsapp_message_queue`
3. Cron job (`process-whatsapp-queue`) processa e envia essa mensagem
4. Se era uma saudação padrão (`automation_rule_id` preenchido + sem `followup_step_id`), agenda os follow-ups configurados

**O que precisamos adicionar:**
- Uma tabela de **etapas de sequência de saudação** (similar à `whatsapp_followup_steps`, mas para a saudação inicial)
- Interface para criar/gerenciar essas etapas por regra (padrão e condicionais)
- Lógica no `webhook-leads` para enfileirar múltiplas mensagens desde o início
- Manter 100% de compatibilidade com o comportamento atual

---

### Arquitetura da Solução

#### Nova tabela: `whatsapp_greeting_sequence_steps`

```
id            uuid (PK)
account_id    uuid
greeting_rule_id   uuid (nullable) → whatsapp_greeting_rules (regras condicionais)
automation_rule_id uuid (nullable) → whatsapp_automation_rules (regra padrão)
template_id   uuid → whatsapp_templates
delay_seconds integer  -- delay relativo à mensagem anterior (0 = imediato após a anterior)
position      integer  -- ordem: 1, 2, 3...
is_active     boolean
name          text     -- nome descritivo ("Mensagem 1", "Mensagem 2"...)
created_at    timestamp
```

**Relação:** cada regra (padrão ou condicional) pode ter **0 ou N etapas de sequência**.
- Se `greeting_sequence_steps` for vazio → comportamento atual (1 mensagem do `template_id`)
- Se tiver etapas → enfileira todas na ordem, com delay relativo acumulado

---

### Fluxo Completo (novo)

```
Lead chega
    ↓
webhook-leads avalia regras condicionais
    ↓
Encontra regra (condicional ou padrão)
    ↓
Busca greeting_sequence_steps da regra
    ↓
    ┌─ Sem etapas de sequência ──────────────────────────────┐
    │  Comportamento atual: enfileira 1 mensagem (template_id) │
    └──────────────────────────────────────────────────────────┘
    
    ┌─ Com etapas de sequência ──────────────────────────────────┐
    │  Step 1: delay_base + step1.delay_seconds → 1ª mensagem    │
    │  Step 2: delay_step1 + step2.delay_seconds → 2ª mensagem   │
    │  Step 3: delay_step2 + step3.delay_seconds → 3ª mensagem   │
    └────────────────────────────────────────────────────────────┘
    ↓
process-whatsapp-queue envia normalmente (sem mudanças)
```

---

### Arquivos a Modificar

#### 1. Migração SQL (nova tabela)

```sql
CREATE TABLE public.whatsapp_greeting_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  automation_rule_id uuid REFERENCES whatsapp_automation_rules(id) ON DELETE CASCADE,
  greeting_rule_id uuid,  -- referência à whatsapp_greeting_rules
  template_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 1,
  delay_seconds integer NOT NULL DEFAULT 5,
  name text NOT NULL DEFAULT 'Mensagem',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.whatsapp_greeting_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sequence steps"
  ON public.whatsapp_greeting_sequence_steps
  FOR ALL USING (account_id = get_user_account_id());
CREATE POLICY "Service role can manage sequence steps"
  ON public.whatsapp_greeting_sequence_steps
  FOR ALL USING (auth.role() = 'service_role');
```

#### 2. `supabase/functions/webhook-leads/index.ts`

Na seção onde hoje faz o `INSERT` de 1 mensagem na fila (linhas 675-694), adicionar:

```typescript
// Buscar etapas de sequência para a regra encontrada
const { data: seqSteps } = await supabase
  .from('whatsapp_greeting_sequence_steps')
  .select('*')
  .eq(matchedRule ? 'greeting_rule_id' : 'automation_rule_id', matchedRule?.id || automationRule.id)
  .eq('account_id', accountId)
  .eq('is_active', true)
  .order('position')

if (seqSteps && seqSteps.length > 0) {
  // Enfileirar N mensagens em sequência
  let accumulatedDelay = delaySeconds  // delay base da regra
  const inserts = seqSteps.map(step => {
    accumulatedDelay += step.delay_seconds
    return {
      account_id: accountId,
      lead_id: lead.id,
      phone: lead.phone,
      message: '',  // resolvido no process-queue
      template_id: step.template_id,
      automation_rule_id: ruleId,
      scheduled_for: new Date(Date.now() + accumulatedDelay * 1000).toISOString(),
      status: 'pending'
    }
  })
  await supabase.from('whatsapp_message_queue').insert(inserts)
} else {
  // Comportamento atual: 1 única mensagem
  await supabase.from('whatsapp_message_queue').insert({ ... })
}
```

#### 3. `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Na seção "Template Padrão (fallback)" da Saudação Automática, adicionar um botão **"Configurar Sequência"** que abre um modal de gerenciamento das etapas.

Exibir um resumo visual: `Mensagem 1 → +5s → Mensagem 2 → +10s → Mensagem 3`

#### 4. Novo componente: `src/components/whatsapp/GreetingSequenceModal.tsx`

Modal completo para gerenciar a sequência de mensagens de uma regra:

- Lista das etapas na ordem
- Para cada etapa: nome, template selecionado, delay em segundos
- Botão para adicionar etapa (máx. 5 por regra)
- Botão para remover etapa
- Reordenação por drag (ou setas ↑↓)
- Suporte tanto para regra padrão (`automation_rule_id`) quanto para regras condicionais (`greeting_rule_id`)

---

### Compatibilidade Garantida

- **Sem etapas configuradas** → `seqSteps.length === 0` → comportamento 100% idêntico ao atual (1 mensagem do `template_id` da regra)
- **Fontes desativadas (OLX, etc.)** → verificação ocorre antes de enfileirar qualquer mensagem, seja 1 ou múltiplas
- **Regras condicionais** → mesma lógica, o campo `greeting_rule_id` separa da regra padrão
- **Follow-up automático** → inalterado; continua sendo agendado após o envio da 1ª mensagem da sequência (pelo `process-whatsapp-queue` que detecta `automation_rule_id` sem `followup_step_id`)
- **`process-whatsapp-queue`** → sem mudanças necessárias; cada mensagem é um registro independente na fila

---

### Exemplo Visual do que será construído

```
Saudação Automática
├─ Template Padrão: "Boas-vindas"
├─ [Configurar Sequência] ← novo botão
│
└─ Sequência de Mensagens (quando ativada):
   ┌────────────────────────────────────────┐
   │ 1. Mensagem 1   [Template: Boas-vindas]  delay: 0s   │
   │    ↓ (+5 segundos)                                    │
   │ 2. Mensagem 2   [Template: Pergunta]     delay: 5s   │
   │    ↓ (+10 segundos)                                   │
   │ 3. Mensagem 3   [Template: CTA]          delay: 10s  │
   │ [+ Adicionar mensagem]                                │
   └────────────────────────────────────────┘
```
