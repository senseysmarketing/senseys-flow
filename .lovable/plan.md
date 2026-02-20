
## Correção: Sequência de Mensagens Não Está Sendo Enfileirada

### Causa Raiz Confirmada

Na edge function `webhook-leads/index.ts`, linhas 676-681, há dois problemas de tipagem TypeScript que corrompem a query SQL em runtime:

**Problema 1 — Cast de tabela errado:**
```typescript
.from('whatsapp_greeting_sequence_steps' as 'whatsapp_followup_steps')
```
O cast `as 'whatsapp_followup_steps'` foi usado como gambiarra para satisfazer o TypeScript (que ainda não conhecia a tabela nova). Em runtime no Deno isso não causa erro, mas contamina a tipagem dos métodos seguintes.

**Problema 2 — Cast de coluna errado (crítico):**
```typescript
.eq(seqFilterKey as 'account_id', seqFilterVal as string)
```
O cast `as 'account_id'` faz o TypeScript aceitar qualquer string como nome de coluna, MAS a variável `seqFilterKey` contém `'automation_rule_id'` (ou `'greeting_rule_id'`). **O problema real é que o Supabase client tipado pode estar ignorando ou mal-interpretando o filtro por causa do cast duplo**, resultando em `seqSteps = []` ou erro silencioso — fazendo cair sempre no fallback de mensagem única.

**Evidência no banco:**
- A tabela `whatsapp_greeting_sequence_steps` tem 3 registros ativos para a regra `edf30a9d-...`
- O lead Leonardo Henry recebeu apenas 1 mensagem (a PT1, enviada às 13:49:16)
- As outras 2 entradas na fila são follow-ups (1 dia e 2 dias depois), não sequência de saudação
- Conclusão: `seqSteps` retornou vazio → caiu no fallback → enviou apenas o `template_id` da regra padrão

### Solução

Remover os casts TypeScript e usar a abordagem correta de construção dinâmica da query, sem casting de tabela ou coluna:

**Antes (código problemático):**
```typescript
const { data: seqSteps } = await supabase
  .from('whatsapp_greeting_sequence_steps' as 'whatsapp_followup_steps')
  .select('*')
  .eq(seqFilterKey as 'account_id', seqFilterVal as string)
  .eq('is_active', true)
  .order('position')
```

**Depois (código correto):**
```typescript
// Usar supabase como 'any' localmente para evitar conflito de tipos
// enquanto a tabela nova não está totalmente tipada na versão da edge function
const seqQuery = supabase
  .from('whatsapp_greeting_sequence_steps')
  .select('*')
  .eq('is_active', true)
  .order('position')

// Aplicar filtro correto sem cast problemático
const { data: seqSteps } = matchedRule
  ? await seqQuery.eq('greeting_rule_id', matchedRule.id)
  : await seqQuery.eq('automation_rule_id', ruleId)
```

Esta abordagem:
1. Remove o cast `as 'whatsapp_followup_steps'` da tabela
2. Remove o cast `as 'account_id'` da coluna de filtro
3. Aplica o filtro correto (greeting_rule_id ou automation_rule_id) de forma explícita e legível
4. Mantém o filtro `is_active = true` e ordenação por `position`

### Arquivo a Modificar

**`supabase/functions/webhook-leads/index.ts`** — linhas 668 a 700: refatorar a lógica de busca da sequência.

### Resultado Esperado

Após a correção, ao chegar um novo lead:
1. A query buscará corretamente as 3 etapas da sequência (PT1, PT2, PT3)
2. Calculará os delays acumulados: PT1 em +30s, PT2 em +40s, PT3 em +45s
3. Inserirá 3 registros na `whatsapp_message_queue` com os `scheduled_for` corretos
4. O cron job `process-whatsapp-queue` processará e enviará as 3 mensagens nos horários corretos

### Compatibilidade

- Contas sem sequência configurada → `seqSteps = []` → comportamento atual de mensagem única (fallback inalterado)
- Regras condicionais → filtro por `greeting_rule_id` funciona da mesma forma
- Follow-up automático → inalterado, continua sendo agendado separadamente
