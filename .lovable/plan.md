
## Correcao do Espelhamento de Mensagens WhatsApp

### Diagnostico confirmado

1. **Tela de conversas vazia**: A query na linha 95 de `use-conversations.tsx` faz `.eq('session_phone', currentPhone)`, mas muitas conversas tem `session_phone = null`, escondendo dados validos.
2. **31 duplicatas reais**: 14.064 mensagens com `message_id`, apenas 14.033 unicas. Sem constraint UNIQUE no banco.
3. **Insercao nao atomica**: O webhook faz `SELECT` + `INSERT` separados (linhas 436-454), permitindo corrida de condicao.
4. **unread_count pode inflar**: Na funcao `upsertConversation` (linha 189), o `unread_count++` acontece independente de saber se a mensagem foi realmente inserida ou ja existia.

### Sobre os pontos do ChatGPT

- **UNIQUE com instance_id**: Verificado no banco -- todas as contas tem exatamente 1 instancia. `UNIQUE(account_id, message_id)` e suficiente. Nao precisa de `instance_id`.
- **session_phone OR null como temporario**: Concordo. O plano inclui backfill + garantia de preenchimento futuro. O filtro `OR IS NULL` sera temporario ate o backfill concluir.
- **whatsapp_jid_mapping**: Concordo em nao criar agora. `lid_jid` + `jid_locked` cobrem o cenario atual.
- **unread_count idempotente**: Ponto valido e nao coberto anteriormente. Sera incluido.

---

### Implementacao

#### 1. Migracao SQL

**Backfill session_phone** nas conversas existentes usando o phone_number da sessao ativa:
```sql
UPDATE whatsapp_conversations wc
SET session_phone = ws.phone_number
FROM whatsapp_sessions ws
WHERE wc.account_id = ws.account_id
  AND wc.session_phone IS NULL
  AND ws.phone_number IS NOT NULL;
```

**Remover duplicatas** (manter a mais antiga):
```sql
DELETE FROM whatsapp_messages
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY account_id, message_id
      ORDER BY created_at ASC
    ) as rn
    FROM whatsapp_messages
    WHERE message_id IS NOT NULL
  ) sub
  WHERE rn > 1
);
```

**Criar UNIQUE index parcial**:
```sql
CREATE UNIQUE INDEX idx_whatsapp_messages_unique_msg
  ON whatsapp_messages(account_id, message_id)
  WHERE message_id IS NOT NULL;
```

#### 2. Frontend: `src/hooks/use-conversations.tsx`

Linha 95: trocar `.eq('session_phone', currentPhone)` por filtro que inclui `session_phone = currentPhone` OU `session_phone IS NULL`:
```typescript
.or(`session_phone.eq.${currentPhone},session_phone.is.null`)
```

Isso resolve o bug imediato. Apos backfill, a maioria tera `session_phone` preenchido.

#### 3. Backend: `supabase/functions/whatsapp-webhook/index.ts`

**3a. Trocar SELECT+INSERT por INSERT ON CONFLICT DO NOTHING** (linhas 436-478):

Remover o bloco de verificacao manual (linhas 436-454). Substituir o INSERT da linha 460 por:
```typescript
const { data: inserted } = await supabase
  .from('whatsapp_messages')
  .upsert({
    account_id: session.account_id,
    remote_jid: storeJid,
    phone: finalPhone,
    message_id: messageId,
    content,
    media_type: mediaType,
    media_url: mediaUrl,
    is_from_me: isFromMe,
    status: isFromMe ? 'sent' : 'received',
    timestamp: ...,
    lead_id: leadId,
    contact_name: contactName,
    session_phone: session.phone_number || null,
  }, { onConflict: 'account_id,message_id', ignoreDuplicates: true })
  .select('id')
```

**3b. unread_count condicional**: Passar o resultado do insert para `upsertConversation`. So incrementar `unread_count` se a mensagem foi realmente inserida (ou seja, `inserted?.length > 0`). Adicionar parametro `wasInserted: boolean` a funcao `upsertConversation`:
```typescript
if (!isFromMe && wasInserted) updateData.unread_count = (existing.unread_count || 0) + 1
```

#### 4. Backend: `supabase/functions/whatsapp-send/index.ts`

Garantir que ao inserir em `whatsapp_messages` e ao fazer upsert de conversa, o campo `session_phone` seja preenchido buscando da sessao ativa.

---

### Arquivos a editar

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Backfill session_phone, remover duplicatas, UNIQUE index |
| `src/hooks/use-conversations.tsx` | Filtro session_phone OR null |
| `supabase/functions/whatsapp-webhook/index.ts` | INSERT ON CONFLICT + unread_count condicional |
| `supabase/functions/whatsapp-send/index.ts` | Garantir session_phone no upsert de conversa |

### Resultado esperado

- Tela de conversas mostra todas as conversas imediatamente
- Zero duplicatas futuras (constraint UNIQUE atomica)
- unread_count nunca infla por webhook duplicado
- session_phone preenchido em todas as conversas futuras e retroativamente
