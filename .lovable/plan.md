

## Corrigir Webhook WhatsApp - Mensagens Recebidas Nao Aparecem

### Problema Diagnosticado

Dois bugs encontrados nos logs da edge function `whatsapp-webhook`:

1. **`messages.update` crashando**: Erro repetido `TypeError: updates is not iterable` (linha 241). A Evolution API envia `data` como objeto, mas o codigo tenta iterar como array.

2. **`messages.upsert` silenciosamente ignorando mensagens**: O handler espera `data.messages` como array, mas dependendo da versao/formato da Evolution API, os dados podem vir em estrutura diferente (ex: array direto, ou objeto sem propriedade `messages`). Quando `data?.messages` e `undefined`, o handler processa um array vazio sem registrar nenhum erro.

**Resultado**: A mensagem "opa" do Leo Henry foi recebida pelo webhook (log confirma `messages.upsert` as 17:00), mas nao foi persistida no banco de dados.

### Correcoes

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

**1. Corrigir `handleMessagesUpsert` (prioridade alta)**

Adicionar tratamento robusto do formato de dados e logging:

```text
Antes:
  const messages = data?.messages || []

Depois:
  // Aceitar diferentes formatos da Evolution API
  let messages = []
  if (Array.isArray(data)) {
    messages = data
  } else if (data?.messages && Array.isArray(data.messages)) {
    messages = data.messages
  } else if (data?.message) {
    messages = [data.message]
  } else if (data?.key) {
    messages = [data]  // Objeto unico de mensagem
  }
  
  console.log(`[whatsapp-webhook] Processing ${messages.length} messages`)
  
  if (messages.length === 0) {
    console.log('[whatsapp-webhook] No messages to process, raw data keys:', Object.keys(data || {}))
  }
```

**2. Corrigir `handleMessagesUpdate` (corrige crash)**

```text
Antes:
  const updates = data || []
  for (const update of updates) { ... }

Depois:
  let updates = []
  if (Array.isArray(data)) {
    updates = data
  } else if (data && typeof data === 'object') {
    updates = [data]
  }
  for (const update of updates) { ... }
```

**3. Adicionar log de debug no switch principal**

Adicionar um log do formato recebido para diagnostico futuro:

```text
console.log('[whatsapp-webhook] Event:', event, 'instance:', instance, 'data type:', typeof data, 'isArray:', Array.isArray(data))
```

### Resultado Esperado

- Mensagens recebidas dos leads serao salvas corretamente no banco
- O erro `updates is not iterable` sera eliminado
- Logs mais detalhados para diagnostico futuro
- A conversa com Leo Henry passara a mostrar as respostas em tempo real

### Detalhes Tecnicos

A alteracao e apenas na edge function `whatsapp-webhook/index.ts`. Apos o deploy, sera necessario enviar uma nova mensagem de teste para confirmar que o recebimento funciona corretamente.

