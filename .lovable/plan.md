
## Diagnóstico Completo: Por Que a Sequência de Saudação Falha para Leads Manuais

### O Problema Real

O código de criação manual de lead em `src/pages/Leads.tsx` (linhas 382–450) **não conhece sequências de saudação**. Ele tem uma lógica simplificada que:

1. Busca a `whatsapp_automation_rule`
2. Busca o **template único** da regra
3. Insere **exatamente 1 mensagem** na fila

Enquanto isso, o banco de dados tem **3 etapas de sequência** configuradas para a mesma regra (`automation_rule_id: edf30a9d...`):
- Passo 1 (PT1): delay 30s → template `7ab08e33`
- Passo 2 (PT2): delay 10s → template `7251ee05`
- Passo 3 (PT3): delay 5s → template `8fe2c644`

Resultado: O frontend enfileira só a PT1. Depois, quando o `process-whatsapp-queue` envia a PT1, detecta que já existe outra mensagem da mesma `automation_rule_id` para o lead (as 3 da fila de follow-up que foram agendadas erroneamente) → considera como sequência de saudação detectada → não agenda mais nada. O lead fica preso com só a primeira mensagem.

### Tabela: O Que Acontece vs O Que Deveria Acontecer

| Passo | O que acontece hoje | O que deveria acontecer |
|---|---|---|
| Lead manual criado | Frontend busca template único da regra | Frontend verifica se há etapas de sequência |
| Enfileiramento | 1 mensagem inserida (PT1, agendada +60s) | 3 mensagens inseridas (PT1, PT2, PT3) |
| process-whatsapp-queue | Envia PT1, detecta "sequência" (por causa dos follow-ups errados) | Envia PT1, PT2, PT3 nos horários corretos |
| Follow-ups (dias) | Agendados ERRADO (ainda sendo agendados) | Não agendados (bloqueados corretamente) |

### Raiz Dupla Confirmada

**Problema A (Principal):** `src/pages/Leads.tsx` não busca `whatsapp_greeting_sequence_steps` e não enfileira as mensagens da sequência.

**Problema B (Ainda ativo):** O `process-whatsapp-queue` ainda agenda os follow-ups de dias (`whatsapp_followup_steps`) após enviar a PT1, porque a verificação de "sequência detectada" está consultando a tabela errada ou a lógica `existingSequenceMsgs` está falhando.

Confirmado pelo banco para o lead "Salomao Teste":
- 1 mensagem `sent` (PT1) - criada pelo frontend às 14:57:57
- 3 mensagens `pending` de follow-up (agendadas para +1 dia, +2 dias, +3 dias) — criadas pelo `process-whatsapp-queue` às 14:59:05

### Fluxo Completo Atual (com bugs)

```text
1. Usuário cria lead manual no Leads.tsx
2. Leads.tsx insere lead no banco ✅
3. Leads.tsx chama apply-distribution-rules ✅
4. Leads.tsx chama notify-new-lead ✅
5. Leads.tsx busca whatsapp_automation_rules ✅
6. Leads.tsx IGNORA whatsapp_greeting_sequence_steps ❌
7. Leads.tsx insere apenas 1 mensagem na fila (PT1) ❌
8. Leads.tsx chama process-whatsapp-queue imediatamente
9. process-whatsapp-queue: "No pending messages" (PT1 agendada +60s)
10. Cron job roda após 1 minuto
11. process-whatsapp-queue envia PT1 ✅
12. process-whatsapp-queue verifica: existingSequenceMsgs? → NENHUMA outra msg desta automation_rule
13. process-whatsapp-queue agenda follow-ups de DIAS (PT1=+1dia, PT2=+2dias, PT3=+3dias) ❌
14. PT2 e PT3 da sequência de saudação (segundos) NUNCA são enviadas ❌
```

### Fluxo Correto (após correção)

```text
1. Usuário cria lead manual no Leads.tsx
2. Leads.tsx insere lead no banco ✅
3. Leads.tsx chama apply-distribution-rules ✅
4. Leads.tsx chama notify-new-lead ✅
5. Leads.tsx busca whatsapp_automation_rules ✅
6. Leads.tsx busca whatsapp_greeting_sequence_steps para automation_rule_id ✅
7. SE há sequência: insere 3 mensagens (PT1 +30s, PT2 +40s, PT3 +45s) ✅
8. SE não há sequência: insere 1 mensagem única (comportamento atual) ✅
9. Cron job roda
10. process-whatsapp-queue envia PT1 ✅
11. process-whatsapp-queue verifica existingSequenceMsgs → encontra PT2 e PT3 ✅
12. process-whatsapp-queue PULA agendamento de follow-ups ✅
13. Cron job seguinte envia PT2, depois PT3 ✅
```

### Solução: 2 correções

---

#### Correção 1: `src/pages/Leads.tsx` — Buscar e enfileirar sequência de saudação

Substituir a lógica atual (linhas 398–444) que só busca 1 template por uma que:
1. Busca `whatsapp_greeting_sequence_steps` filtrado por `automation_rule_id`
2. Se houver etapas → insere todas na fila com delays acumulados (igual ao `webhook-leads`)
3. Se não houver → comportamento atual (1 mensagem única)

```ts
if (automationRule.template_id && manualEnabled && session) {
  // NOVO: verificar se há sequência de saudação configurada
  const { data: seqSteps } = await supabase
    .from('whatsapp_greeting_sequence_steps')
    .select('*')
    .eq('automation_rule_id', automationRule.id)
    .eq('is_active', true)
    .order('position');

  if (seqSteps && seqSteps.length > 0) {
    // Enfileirar TODAS as etapas da sequência
    let accumulated = automationRule.delay_seconds || 0;
    const inserts = seqSteps.map((step) => {
      accumulated += (step.delay_seconds || 0);
      return {
        account_id: profile.account_id,
        lead_id: insertedLead.id,
        phone: newLead.phone,
        message: '',
        template_id: step.template_id,
        automation_rule_id: automationRule.id,
        scheduled_for: new Date(Date.now() + accumulated * 1000).toISOString(),
        status: 'pending'
      };
    });
    await supabase.from('whatsapp_message_queue').insert(inserts);
  } else {
    // Comportamento atual: 1 mensagem única com template resolvido
    // ... código existente ...
  }
}
```

---

#### Correção 2: `process-whatsapp-queue/index.ts` — Limpeza dos follow-ups incorretos do Salomao Teste

Os 3 follow-ups agendados para +1 dia, +2 dias e +3 dias para o lead "Salomao Teste" precisam ser cancelados. Além disso, a lógica de detecção de sequência no `process-whatsapp-queue` (que verifica `existingSequenceMsgs`) precisa excluir mensagens com `followup_step_id IS NOT NULL` da busca, já que esses são follow-ups e não parte da sequência de saudação.

```ts
// Verificar se há OUTRAS mensagens de saudação (sem followup_step_id) da mesma regra
const { data: existingSequenceMsgs } = await supabase
  .from('whatsapp_message_queue')
  .select('id')
  .eq('lead_id', msg.lead_id)
  .eq('automation_rule_id', msg.automation_rule_id)
  .is('followup_step_id', null)  // NOVO: ignorar follow-ups
  .neq('id', msg.id)
  .limit(1)
```

---

### Limpeza de Dados (SQL a executar antes do deploy)

Cancelar os 3 follow-ups incorretos do lead "Salomao Teste":

```sql
UPDATE whatsapp_message_queue
SET status = 'cancelled',
    error_message = 'Cancelado: follow-up agendado incorretamente no lugar de sequência de saudação'
WHERE lead_id = '6904210a-33dd-4bfb-ba32-4c0c492c1ecf'
AND status = 'pending'
AND followup_step_id IS NOT NULL;
```

---

### Arquivos a Modificar

1. **`src/pages/Leads.tsx`** — Linhas 398–444: substituir lógica de enfileiramento único por lógica com suporte a sequências (igual ao `webhook-leads`)
2. **`supabase/functions/process-whatsapp-queue/index.ts`** — Linha ~331: adicionar `.is('followup_step_id', null)` na query de detecção de sequência existente

### Por que isso resolve definitivamente

- Lead manual via `Leads.tsx`: PT1, PT2, PT3 enfileiradas de uma vez com delays corretos (segundos)
- `process-whatsapp-queue` envia cada uma no momento certo
- A detecção de "sequência existente" no `process-whatsapp-queue` agora filtra corretamente para não confundir follow-ups (dias) com etapas de saudação (segundos)
- Follow-ups de acompanhamento (dias) continuam funcionando normalmente para leads sem sequência de saudação
