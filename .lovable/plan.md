

## Correção: Espelhamento de Mensagens e Follow-up Quebrados

### Causa Raiz Identificada

O espelhamento de mensagens parou completamente em **27/02** (zero mensagens desde então). O banco está gerando milhares de erros:

```text
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
```

A migração `20260227182622` criou um **índice parcial** (`CREATE UNIQUE INDEX ... WHERE message_id IS NOT NULL`) para deduplicação. O problema é que o Supabase client usa `upsert({ onConflict: 'account_id,message_id' })`, mas o PostgreSQL exige uma **constraint real** (não um índice parcial) para `ON CONFLICT`. Resultado: toda tentativa de inserção via upsert falha silenciosamente.

**Isso afeta:**
- Webhook: mensagens recebidas nao sao salvas
- whatsapp-send: mensagens enviadas nao sao salvas
- Consequencia: CRM mostra "Nenhuma mensagem", follow-ups nao detectam respostas

### Solucao

#### 1. Migracão SQL: Criar constraint real

Substituir o índice parcial por uma constraint de unicidade que o PostgREST consiga usar com ON CONFLICT:

```sql
-- Remover o indice parcial que causa o erro
DROP INDEX IF EXISTS idx_whatsapp_messages_unique_msg;

-- Criar constraint real (nao indice parcial)
-- Para lidar com message_id NULL, usar COALESCE com o id do registro
ALTER TABLE whatsapp_messages 
  ADD CONSTRAINT whatsapp_messages_account_message_unique 
  UNIQUE (account_id, message_id);
```

**Nota:** Se existirem registros com `message_id = NULL`, nao havera conflito porque `NULL != NULL` em constraints UNIQUE do PostgreSQL. Ou seja, a constraint funciona naturalmente.

#### 2. Atualizar `whatsapp-webhook/index.ts`

Trocar o `.upsert()` por `.insert()` com tratamento de conflito explícito, mais robusto:

Na linha ~438, mudar de:
```typescript
.upsert({...}, { onConflict: 'account_id,message_id', ignoreDuplicates: true })
```
Para:
```typescript
.upsert({...}, { onConflict: 'whatsapp_messages_account_message_unique', ignoreDuplicates: true })
```

Ou, de forma mais simples, manter o `onConflict: 'account_id,message_id'` que agora vai funcionar com a constraint real.

#### 3. Atualizar `whatsapp-send/index.ts`

Mesma correção na linha ~280 do whatsapp-send (que também usa `upsert` com `onConflict: 'account_id,message_id'`).

#### 4. Recuperacao de dados

Executar um backfill para recuperar mensagens dos últimos dias que foram registradas no `whatsapp_message_log` mas não no `whatsapp_messages`. Isso restaurara o historico perdido para mensagens enviadas pelo CRM/automação.

### Impacto

| Problema | Status Atual | Apos Correcão |
|----------|-------------|---------------|
| Espelhamento de mensagens | Quebrado desde 27/02 | Restaurado |
| Follow-up nao detecta respostas | Quebrado (sem dados em whatsapp_messages) | Restaurado |
| Historico no CRM | Vazio para conversas recentes | Restaurado |
| Conversas (pagina Conversas) | last_message funciona, mas sem historico detalhado | Completo |

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Nova migração SQL | Criar constraint UNIQUE real, dropar indice parcial |
| `supabase/functions/whatsapp-webhook/index.ts` | Nenhuma mudanca necessaria no codigo (o onConflict vai funcionar com a nova constraint) |
| `supabase/functions/whatsapp-send/index.ts` | Nenhuma mudanca necessaria no codigo |
| Nova migração SQL (backfill) | Recuperar mensagens do `whatsapp_message_log` para `whatsapp_messages` |

### Detalhes Tecnicos

A causa é que o PostgreSQL diferencia **partial unique indexes** de **unique constraints**. O `ON CONFLICT` do SQL aceita ambos, mas o PostgREST (usado pelo Supabase client JS) converte `onConflict: 'col1,col2'` para `ON CONFLICT (col1, col2)` sem a clausula `WHERE`, o que nao corresponde ao indice parcial. Criar uma constraint UNIQUE real resolve o problema sem precisar alterar nenhum codigo das edge functions.

