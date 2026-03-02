
## Correcao: Follow-up nao dispara para leads do Meta Ads (Facebook/Instagram)

### Causa Raiz

A funcao `meta-webhook/index.ts` (que processa leads do Facebook/Instagram) **nunca foi migrada** para o novo sistema de automacao (`whatsapp_automation_control`). Ela ainda usa exclusivamente a fila legada (`whatsapp_message_queue`), que so agenda as mensagens de **saudacao**.

O fluxo de follow-up (etapas 1, 2, 3 com delays de 2h, 24h, 24h) depende inteiramente do `whatsapp_automation_control`, que contem um snapshot com as etapas de greeting + followup e e processado pela state machine no worker.

**Prova nos dados:**
- A conta T&B tem **3 etapas de follow-up** configuradas na tabela `whatsapp_followup_steps` (2h, 24h, 24h)
- Porem, tem **zero registros** na tabela `whatsapp_automation_control`
- Todos os leads sao de origem Facebook -- entram pelo `meta-webhook`
- O `meta-webhook` so insere na `whatsapp_message_queue` (saudacao) e nunca cria o registro de controle
- Enquanto isso, o `webhook-leads` (usado por Webhook/OLX) ja foi migrado e cria o `automation_control` corretamente (linhas 649-740)

**Por que a saudacao funciona mas o follow-up nao:**
- Saudacao: inserida diretamente na `whatsapp_message_queue` pelo `meta-webhook` -- funciona
- Follow-up: depende do `automation_control` para ser agendado pelo worker -- nunca criado, portanto nunca dispara

### Solucao

Migrar a logica do `meta-webhook/index.ts` (linhas 374-441) para usar o `whatsapp_automation_control`, replicando exatamente o padrao do `webhook-leads/index.ts` (linhas 649-740).

### Implementacao

**Arquivo: `supabase/functions/meta-webhook/index.ts`**

Substituir o bloco das linhas 374-441 (que insere na `whatsapp_message_queue`) pelo seguinte fluxo:

1. Construir o `steps_snapshot` com greeting + followup:
   - Buscar `whatsapp_greeting_sequence_steps` (para sequencia de saudacao)
   - Se nao houver sequencia, usar o template unico como step de greeting
   - Buscar `whatsapp_followup_steps` para a conta e adicionar ao snapshot
   - Para cada step, buscar o `template` da tabela `whatsapp_templates`

2. Inserir registro em `whatsapp_automation_control`:
   ```
   account_id, lead_id, automation_rule_id, phone,
   current_phase: 'greeting',
   current_step_position: 0,
   status: 'active',
   next_execution_at: now + delaySeconds,
   steps_snapshot: { greeting: [...], followup: [...] }
   ```

3. Remover a insercao direta na `whatsapp_message_queue`

4. Manter o `supabase.functions.invoke('process-whatsapp-queue')` para triggerar o worker

Isso e uma substituicao direta -- o codigo do `webhook-leads` ja esta validado e funcionando. A unica diferenca e que no `meta-webhook` as variaveis tem nomes levemente diferentes (`cfg.account_id` vs `accountId`, `newLead.id` vs `lead.id`).

### Resultado esperado

- Leads do Facebook/Instagram passam a ter registro no `automation_control`
- O worker processa a saudacao e, se o lead nao responder, dispara os follow-ups nos intervalos configurados (2h, 24h, 24h)
- Respeita horario de envio (ja implementado no worker)
- Respeita deteccao de resposta (ja implementado no worker)
- Compativel com todas as contas, nao apenas T&B

### Arquivos a editar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/meta-webhook/index.ts` | Substituir insercao na fila legada por criacao de `automation_control` com snapshot completo |
