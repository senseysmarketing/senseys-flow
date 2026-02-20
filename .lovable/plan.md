
## Correção: Sequência de Saudação Não Enviando Todas as Mensagens

### Causa Raiz Identificada

O fluxo de envio envolve dois componentes que entram em conflito:

**1. `webhook-leads`** — ao criar um lead manualmente, busca as etapas de sequência em `whatsapp_greeting_sequence_steps` e deveria enfileirar **todas** as mensagens de uma vez. Para o lead "Leo Henry", só enfileirou **1 mensagem** (a PT1), indicando que não encontrou as sequências naquela chamada.

**2. `process-whatsapp-queue`** (linhas 319–365) — depois de enviar a primeira mensagem com sucesso, **ativa uma lógica adicional** que busca follow-ups em `whatsapp_followup_steps` (tabela dos follow-ups pós-saudação, com delays de 1440+ minutos) e agenda novos itens na fila. Esta lógica foi adicionada para suportar follow-ups automáticos, mas está sendo ativada **também para mensagens de sequência de saudação**, causando:
- Agendamento de Follow-Up PT1 para amanhã (1440 min = 1 dia)  
- Agendamento de Follow-Up PT2 para depois de amanhã (2880 min = 2 dias)
- Agendamento de Follow-Up PT3 para daqui 3 dias (4320 min = 3 dias)

Em vez das mensagens PT2 e PT3 da sequência de saudação com 10s e 5s de delay.

### Dois Problemas a Corrigir

---

#### Problema 1: `process-whatsapp-queue` — lógica de follow-up disparando para sequências de saudação

Quando `process-whatsapp-queue` envia uma mensagem com sucesso, verifica:
```
if (msg.automation_rule_id && !msg.followup_step_id) → agenda follow-ups
```

O problema é que mensagens de **sequência de saudação** também têm `automation_rule_id` e **não** têm `followup_step_id`, então a condição `true` aciona o agendamento dos follow-ups da tabela `whatsapp_followup_steps`.

**Solução:** Verificar se já existem mensagens pendentes/enviadas da sequência de saudação para este lead antes de agendar follow-ups. Se existir qualquer outra mensagem da mesma `automation_rule_id` para o mesmo lead, significa que é uma sequência — não um disparo único — e o follow-up **não deve ser agendado novamente**.

```ts
// ANTES de agendar follow-ups, verificar se já há outras mensagens da sequência de saudação
const { data: existingSequenceMsgs } = await supabase
  .from('whatsapp_message_queue')
  .select('id')
  .eq('lead_id', msg.lead_id)
  .eq('automation_rule_id', msg.automation_rule_id)
  .neq('id', msg.id) // exclude the current message
  .limit(1)

// Se já existem outras mensagens desta automação para este lead, é uma sequência de saudação
// Neste caso não agendar follow-ups (eles já foram enfileirados pelo webhook)
if (existingSequenceMsgs && existingSequenceMsgs.length > 0) {
  console.log(`[process-whatsapp-queue] Greeting sequence detected for lead ${msg.lead_id}, skipping follow-up scheduling`)
  // skip follow-up scheduling
}
```

---

#### Problema 2: `webhook-leads` — sequência não foi enfileirada corretamente

O `webhook-leads` faz a query em `whatsapp_greeting_sequence_steps` filtrando por `automation_rule_id = ruleId` (linha 679), mas apenas 1 mensagem foi criada para o lead "Leo Henry". Isso pode significar que a query retornou vazio. A causa provável é que o `ruleId` no momento da query ainda era `null` ou diferente do ID da regra que tem a sequência configurada.

**Solução:** Adicionar log de debug e garantir que a query da sequência utiliza o mesmo `ruleId` que foi encontrado. Além disso, adicionar verificação de que o `ruleId` não é nulo antes de buscar as sequências:

```ts
if (templateId && ruleId) { // garantir que ruleId é válido
  const seqQuery = ...
  const { data: seqSteps, error: seqError } = ...
  if (seqError) console.error('Sequence query error:', seqError)
  console.log(`Sequence steps found: ${seqSteps?.length || 0} for rule ${ruleId}`)
  ...
}
```

---

### Dados Confirmados no Banco

| Mensagem | Tabela origem | Agendado para | Status |
|---|---|---|---|
| Saudacao PT1 | `whatsapp_greeting_sequence_steps` | 14:33 | ✅ Enviado |
| Follow-Up PT1 | `whatsapp_followup_steps` (errado!) | Amanhã (+1 dia) | ⏳ Pendente |
| Follow-Up PT2 | `whatsapp_followup_steps` (errado!) | Depois de amanhã (+2 dias) | ⏳ Pendente |
| Follow-Up PT3 | `whatsapp_followup_steps` (errado!) | Daqui 3 dias (+3 dias) | ⏳ Pendente |

O que deveria ter sido agendado pelo `webhook-leads`:
| Mensagem | Tabela origem | Agendado para |
|---|---|---|
| Saudacao PT1 | sequência passo 1 (30s) | 14:33 |
| Saudacao PT2 | sequência passo 2 (+10s) | 14:33 + 40s |
| Saudacao PT3 | sequência passo 3 (+5s) | 14:33 + 45s |

---

### Dados Imediatos a Limpar

Os 3 follow-ups errados do lead "Leo Henry" precisam ser cancelados no banco antes do deploy (executar via Supabase SQL):

```sql
UPDATE whatsapp_message_queue
SET status = 'cancelled', error_message = 'Cancelado: follow-up agendado incorretamente no lugar de sequência de saudação'
WHERE lead_id = '7205e0a4-3592-4561-a1f9-8c2ed52e4f40'
AND status = 'pending'
AND followup_step_id IS NOT NULL;
```

---

### Arquivos a Modificar

1. **`supabase/functions/process-whatsapp-queue/index.ts`** — Linhas 319–365: adicionar verificação de sequência existente antes de agendar follow-ups. Esta é a correção **prioritária** pois impede que o bug se repita.

2. **`supabase/functions/webhook-leads/index.ts`** — Linhas 667–731: adicionar logs e verificação de `ruleId` não nulo antes da query de sequências, para diagnosticar por que a sequência não foi enfileirada corretamente.

---

### Impacto

- Leads futuros com sequência de saudação: corrigidos (o follow-up automático não será mais agendado em conflito com a sequência)
- Lead "Leo Henry": os 3 follow-ups errados serão cancelados via SQL direto
- Follow-up automático (pós-saudação, único) continua funcionando normalmente para leads sem sequência configurada
