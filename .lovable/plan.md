

## Correcao: Follow-up enviado mesmo apos resposta do lead

### Problema

O lead "Gabrielly Ricci" respondeu com audios apos a saudacao, mas o follow-up automatico foi enviado mesmo assim. Isso ocorre porque:

1. O webhook (`whatsapp-webhook`) cancela follow-ups pendentes quando recebe mensagens -- mas essa instancia estava com problema de recepcao de eventos (corrigido agora)
2. A edge function `process-whatsapp-queue` **nao faz nenhuma validacao** antes de enviar um follow-up. Ela simplesmente envia tudo que esta com status `pending` e `scheduled_for <= now()`

### Solucao

Adicionar uma verificacao de seguranca diretamente no `process-whatsapp-queue`: antes de enviar qualquer mensagem que tenha `followup_step_id` (ou seja, e um follow-up), consultar a tabela `whatsapp_messages` para verificar se o lead respondeu apos a saudacao. Se houver mensagem recebida (`is_from_me = false`) para aquele lead/telefone, cancelar o follow-up ao inves de enviar.

Isso funciona como uma camada dupla de protecao:
- Camada 1 (ja existe): O webhook cancela follow-ups ao receber mensagem
- Camada 2 (nova): O processador da fila valida antes de enviar

### Secao tecnica

**Arquivo: `supabase/functions/process-whatsapp-queue/index.ts`**

Apos a verificacao de sessao conectada (linha ~93) e antes do envio (linha ~96), adicionar para mensagens de follow-up:

```typescript
// Before sending follow-up messages, check if lead has responded
if (msg.followup_step_id && msg.lead_id) {
  const phoneSuffix = (msg.phone || '').replace(/\D/g, '').slice(-9)
  
  const { data: incomingMessages } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('account_id', msg.account_id)
    .eq('is_from_me', false)
    .ilike('phone', `%${phoneSuffix}%`)
    .limit(1)
  
  if (incomingMessages && incomingMessages.length > 0) {
    console.log(`[process-whatsapp-queue] Lead ${msg.lead_id} already responded, cancelling follow-up ${msg.id}`)
    
    // Cancel this and all remaining follow-ups for this lead
    await supabase
      .from('whatsapp_message_queue')
      .update({ status: 'cancelled' })
      .eq('lead_id', msg.lead_id)
      .eq('status', 'pending')
      .not('followup_step_id', 'is', null)
    
    continue
  }
}
```

Tambem cancelar imediatamente os follow-ups pendentes da Gabrielly Ricci que ja estao na fila, para evitar novos envios enquanto o deploy ocorre.

### Resultado esperado

1. Follow-ups sao cancelados automaticamente se o lead ja respondeu, independentemente do webhook ter processado a cancelamento a tempo
2. A validacao e feita no momento do envio, eliminando race conditions
3. Follow-ups pendentes da Gabrielly Ricci serao cancelados imediatamente

