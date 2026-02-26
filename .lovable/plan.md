

## Correcao: Follow-ups enviados simultaneamente sem cancelamento

### Problema Raiz (3 bugs combinados)

**Bug 1 - Resposta do lead nao armazenada no banco:**
O audio enviado pela lead Karla Teodoro nunca foi registrado na tabela `whatsapp_messages`. O webhook falhou ou a mensagem chegou via @lid sem mapeamento. Sem registro no banco, a verificacao de resposta (linha 273-503) retorna falso e os follow-ups sao enviados.

**Bug 2 - Follow-ups agendados no mesmo horario:**
Os `whatsapp_followup_steps` tem delay_minutes de 120, 1440, 1440 (posicoes 0, 1, 2). O calculo de delta (linha 776) faz `1440 - 1440 = 0`, agendando steps 2 e 3 no mesmo momento. Combinado com business hours, todos os 3 acabam no mesmo slot horario.

**Bug 3 - Sem protecao de lote no loop:**
Quando o cron carrega 50 mensagens pendentes de uma vez (linha 154-164), todas ficam no array em memoria. Mesmo que a mensagem #1 cancele #2 e #3 no banco, as mensagens #2 e #3 ja estao no array e sao processadas sem re-verificar seu status atual no banco.

### Solucao (3 camadas de protecao)

**Camada 1 - Re-check do status no banco antes de processar (CRITICO)**

No inicio do loop `for (const msg of pendingMessages)`, antes de qualquer processamento, re-verificar se a mensagem ainda esta `pending` no banco. Isso garante que cancelamentos feitos pela mensagem anterior no mesmo lote sejam respeitados.

```text
Arquivo: supabase/functions/process-whatsapp-queue/index.ts
Local: Inicio do loop (apos linha 198)

Adicionar:
  // Re-check: message may have been cancelled by a previous iteration
  const { data: freshMsg } = await supabase
    .from('whatsapp_message_queue')
    .select('status')
    .eq('id', msg.id)
    .single()

  if (freshMsg?.status !== 'pending') {
    console.log(`[process-whatsapp-queue] Message ${msg.id} is no longer pending (${freshMsg?.status}), skipping`)
    continue
  }
```

**Camada 2 - Set de leads respondidos em memoria**

Manter um `Set<string>` de lead_ids que ja foram detectados como respondidos durante o lote atual. Se um lead ja esta no set, pular imediatamente sem precisar consultar o banco novamente.

```text
Arquivo: supabase/functions/process-whatsapp-queue/index.ts
Local: Antes do loop (linha 197) e dentro da verificacao de resposta

Adicionar antes do loop:
  const respondedLeads = new Set<string>()

Adicionar no inicio do loop:
  if (msg.lead_id && respondedLeads.has(msg.lead_id)) {
    console.log(`[process-whatsapp-queue] Lead ${msg.lead_id} already responded (cached), skipping ${msg.id}`)
    continue
  }

Adicionar quando detectar resposta (linha 489):
  respondedLeads.add(msg.lead_id)
```

**Camada 3 - Expandir verificacao de resposta para TODAS as mensagens com lead_id**

Atualmente a verificacao so roda para mensagens com `followup_step_id` (linha 273). Mudar para rodar para QUALQUER mensagem que tenha `lead_id`, independente de ter followup_step_id ou nao. Isso protege tambem mensagens de sequencia de saudacao.

```text
Arquivo: supabase/functions/process-whatsapp-queue/index.ts
Local: Linha 273

Mudar de:
  if (msg.followup_step_id && msg.lead_id) {

Para:
  if (msg.lead_id) {
```

Porem, manter a logica interna de cancelamento em massa apenas para follow-ups (com followup_step_id), para nao cancelar saudacoes iniciais caso o lead responda a algo anterior.

**Camada 4 - Garantir delta minimo entre follow-ups**

Adicionar um delta minimo de 60 minutos entre follow-ups sequenciais para evitar envios simultaneos mesmo com configuracao incorreta.

```text
Arquivo: supabase/functions/process-whatsapp-queue/index.ts  
Local: Calculo do delta (linha 776)

Mudar de:
  const deltaMinutes = step.delay_minutes - previousDelayMinutes

Para:
  const deltaMinutes = Math.max(step.delay_minutes - previousDelayMinutes, 60)
```

### Arquivos a editar
- `supabase/functions/process-whatsapp-queue/index.ts` - Todas as 4 camadas de protecao

### Resumo do impacto
1. **Re-check de status** impede que mensagens ja canceladas no banco sejam enviadas
2. **Set em memoria** evita consultas repetidas e garante consistencia dentro do lote
3. **Verificacao expandida** protege sequencias de saudacao alem de follow-ups
4. **Delta minimo** impede 3+ mensagens no mesmo segundo mesmo com config errada

