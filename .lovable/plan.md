

## Correcao: Mensagens duplicadas/triplicadas no chat

### Problema

Quando o usuario envia uma mensagem pelo CRM, ela aparece 2-3 vezes na tela porque tres fontes adicionam a mesma mensagem ao estado:

1. **Adicao otimista** - O `sendMessage` adiciona imediatamente a mensagem com um ID temporario (`crypto.randomUUID()`) para feedback instantaneo
2. **Realtime INSERT** - O webhook salva a mensagem no banco e o Supabase Realtime dispara um evento INSERT, que adiciona a mesma mensagem novamente (com o ID real do banco)
3. **Evento `send.message`** - O webhook agora tambem processa eventos `send.message` da Evolution API, potencialmente criando outra entrada no banco

### Solucao

Corrigir o handler de Realtime para **deduplicar** mensagens antes de adiciona-las, e ajustar o fluxo otimista para ser substituido pela mensagem real quando ela chegar.

### Secao tecnica

**Arquivo: `src/hooks/use-conversations.tsx`**

**Mudanca 1** - No handler de Realtime INSERT (linha ~200), verificar se a mensagem ja existe antes de adicionar:

```typescript
// ANTES (linha 201):
setMessages(prev => [...prev, { id: newMsg.id, ... }]);

// DEPOIS:
setMessages(prev => {
  // Skip if message with same DB id already exists
  if (prev.some(m => m.id === newMsg.id)) return prev;
  
  // Skip if message with same message_id already exists (optimistic or duplicate webhook)
  if (newMsg.message_id && prev.some(m => m.message_id === newMsg.message_id)) {
    // Replace optimistic message with real one (update id and status)
    return prev.map(m => 
      m.message_id === newMsg.message_id 
        ? { ...m, id: newMsg.id, status: newMsg.status }
        : m
    );
  }
  
  // Skip if identical content sent by me within 5 seconds (catches optimistic duplicates)
  if (newMsg.is_from_me) {
    const msgTime = new Date(newMsg.timestamp).getTime();
    const isDuplicate = prev.some(m => 
      m.is_from_me && 
      m.content === newMsg.content && 
      Math.abs(new Date(m.timestamp).getTime() - msgTime) < 5000
    );
    if (isDuplicate) {
      // Replace the optimistic message with the real one
      return prev.map(m => 
        m.is_from_me && 
        m.content === newMsg.content && 
        Math.abs(new Date(m.timestamp).getTime() - msgTime) < 5000
          ? { ...m, id: newMsg.id, status: newMsg.status, message_id: newMsg.message_id }
          : m
      );
    }
  }
  
  return [...prev, { id: newMsg.id, content: newMsg.content, ... }];
});
```

**Mudanca 2** - No `sendMessage` (linha ~264), incluir um marcador para facilitar a deduplicacao. Guardar o `messageId` retornado pela API no objeto otimista:

```typescript
// Apos receber result da API (linha ~257):
const newMsg: Message = {
  id: crypto.randomUUID(),
  content: text,
  media_type: 'text',
  media_url: null,
  is_from_me: true,
  status: 'sent',
  timestamp: new Date().toISOString(),
  contact_name: null,
  message_id: result.messageId || null,  // Usar o messageId real da API
};
```

**Mudanca 3** - No webhook `whatsapp-webhook/index.ts`, garantir que o evento `send.message` nao crie duplicatas no banco. Adicionar verificacao de `message_id` unico antes de inserir:

Antes do INSERT na funcao `handleMessagesUpsert`, verificar se ja existe uma mensagem com o mesmo `message_id`:

```typescript
// Check for existing message to prevent duplicates from send.message + messages.upsert
if (messageId) {
  const { data: existing } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('account_id', session.account_id)
    .eq('message_id', messageId)
    .maybeSingle();
  
  if (existing) {
    console.log('[whatsapp-webhook] Message already exists, skipping:', messageId);
    return; // Skip duplicate
  }
}
```

### Resultado esperado

1. Cada mensagem aparece **exatamente uma vez** no chat
2. A mensagem otimista aparece instantaneamente e e substituida silenciosamente pela versao real do banco
3. Eventos duplicados do webhook (send.message + messages.upsert para a mesma mensagem) nao criam entradas duplicadas no banco

