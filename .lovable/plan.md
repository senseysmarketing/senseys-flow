

## Blindagem do Sistema de Mensagens WhatsApp (Refinado)

### Mudancas

#### 1. Migration SQL: Adicionar `last_customer_message_at`

Adicionar coluna `last_customer_message_at` (timestamptz, nullable) na tabela `whatsapp_conversations`. Permite queries de inatividade sem consultar `whatsapp_messages`.

#### 2. `whatsapp-webhook/index.ts` - Guard de message_id + Estado da conversa

**Guard de message_id (linha ~444):**
Antes do upsert em `whatsapp_messages`, garantir que `messageId` nunca seja NULL:

```typescript
const safeMessageId = messageId ?? `${instanceName}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`
```

Formato rastreavel: inclui nome da instancia + timestamp + sufixo unico.

**Estado da conversa na funcao `upsertConversation` (linha ~170):**
Adicionar parametro `messageTimestamp` e atualizar `last_customer_message_at` quando `!isFromMe`:

```typescript
if (!isFromMe) updateData.last_customer_message_at = messageTimestamp || now
```

Isso garante que `last_message_is_from_me`, `last_message_at` e `last_customer_message_at` sao atualizados atomicamente numa unica operacao de UPDATE, eliminando o risco de estado inconsistente entre mensagem salva e conversa nao atualizada.

#### 3. `whatsapp-send/index.ts` - Guard de message_id

Na linha ~280, antes do upsert em `whatsapp_messages`:

```typescript
const safeMessageId = sendData.key?.id ?? `${session.instance_name}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`
```

Substituir `sendData.key?.id` por `safeMessageId` no upsert e no log.

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Nova migracao SQL | `ALTER TABLE whatsapp_conversations ADD COLUMN last_customer_message_at timestamptz` |
| `supabase/functions/whatsapp-webhook/index.ts` | Guard message_id NULL + passar timestamp para upsertConversation + atualizar `last_customer_message_at` |
| `supabase/functions/whatsapp-send/index.ts` | Guard message_id NULL |

### Formato do message_id fallback

```text
senseys_abc123-1709398400000-f7a3b2c1
```

- Prefixo da instancia para rastreabilidade
- Timestamp para ordenacao temporal
- Sufixo UUID curto para unicidade

### Garantia de consistencia

O ponto critico levantado sobre `last_message_is_from_me` ja e tratado atomicamente na funcao `upsertConversation` (linhas 181-195): ela faz um unico UPDATE com `last_message`, `last_message_at` e `last_message_is_from_me` juntos. Com a adicao de `last_customer_message_at` nesse mesmo UPDATE, todos os campos de estado da conversa serao atualizados numa operacao atomica, eliminando o risco de inconsistencia.

