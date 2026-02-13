
## Correcao: Mensagens enviadas pelo celular criando conversas duplicadas com @lid

### Problema

Quando o usuario envia mensagens pelo celular (WhatsApp), a Evolution API envia webhooks com identificadores `@lid` (Linked ID) em vez do numero real `@s.whatsapp.net`. Isso cria conversas separadas:
- **Conversa real**: `5516994213312@s.whatsapp.net` (Biel Facioli) - apenas mensagens recebidas
- **Conversa fantasma**: `192723789303918@lid` (Anz Imoveis) - apenas mensagens enviadas

O resultado: as conversas parecem incompletas, mostrando apenas um lado do dialogo.

Alem disso, a funcao de sync (`findMessages`) retorna arrays vazios pois a Evolution API nao persiste mensagens localmente sem configuracao de banco (MongoDB/PostgreSQL store).

### Causa raiz

A Evolution API v2 usa `@lid` para mensagens enviadas via celular Android. Esse e um problema conhecido (issues #1872, #1916 no GitHub da Evolution API). O webhook recebe payloads como:
```text
Outgoing: {"key":{"remoteJid":"192723789303918@lid","fromMe":true}}
Incoming: {"key":{"remoteJid":"5516994213312@s.whatsapp.net","fromMe":false}}
```

Sao a mesma conversa, mas com JIDs diferentes.

### Solucao

Resolver o @lid para o numero real usando o endpoint `findContacts` da Evolution API, com fallback para mapeamento interno baseado no campo `previousRemoteJid` que alguns payloads incluem.

### Etapas

**1. Adicionar coluna `lid_jid` na tabela `whatsapp_conversations`**

Armazena o mapeamento @lid para cada conversa, permitindo lookups futuros.

```sql
ALTER TABLE whatsapp_conversations ADD COLUMN lid_jid text;
CREATE INDEX idx_conversations_lid_jid ON whatsapp_conversations(lid_jid) WHERE lid_jid IS NOT NULL;
```

**2. Modificar o webhook (`whatsapp-webhook/index.ts`)**

Adicionar funcao `resolveLidToPhone` que:
- Chama `POST /chat/findContacts/{instance}` com `{ "where": { "id": "xxx@lid" } }` para obter o numero real
- Se encontrar, retorna o JID normalizado `@s.whatsapp.net`
- Se nao encontrar, retorna null

Modificar `handleMessagesUpsert`:
- Extrair `previousRemoteJid` do payload de mensagens recebidas e salvar como `lid_jid` na conversa correspondente
- Para mensagens enviadas (`fromMe: true`) com `@lid`:
  1. Tentar resolver via `findContacts` na Evolution API
  2. Se nao resolver, buscar conversa com aquele `lid_jid` no banco
  3. Se encontrar o JID real, usar ele para armazenar a mensagem e atualizar a conversa
  4. Se nao encontrar, armazenar a mensagem com @lid mas NAO criar nova conversa (evita fantasmas)

**3. Limpeza dos dados existentes**

SQL para:
- Identificar @lid conversations e suas mensagens
- Tentar re-atribuir mensagens @lid para conversas @s.whatsapp.net existentes (usando proximidade temporal de mensagens)
- Deletar conversas @lid orfas

**4. Ajustar o frontend (`use-conversations.tsx`)**

- Filtrar conversas @lid da lista (como fallback, caso alguma escape)
- Remover a chamada ao `whatsapp-sync-messages` que retorna sempre vazio (nao funciona sem message store configurado na Evolution API)

### Secao tecnica detalhada

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Nova funcao:
```typescript
async function resolveLidToPhone(instanceName: string, lidJid: string): Promise<string | null> {
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null
  
  const apiUrl = EVOLUTION_API_URL.startsWith('http') ? EVOLUTION_API_URL : `https://${EVOLUTION_API_URL}`
  try {
    const res = await fetch(`${apiUrl}/chat/findContacts/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ where: { id: lidJid } })
    })
    const contacts = await res.json()
    // Extract phone from contact response
    const contact = Array.isArray(contacts) ? contacts[0] : contacts
    const phoneJid = contact?.id || contact?.jid || contact?.remoteJid
    if (phoneJid && phoneJid.includes('@s.whatsapp.net')) {
      return normalizeBrazilianJid(phoneJid)
    }
  } catch (e) {
    console.error('[whatsapp-webhook] findContacts error:', e)
  }
  return null
}
```

Modificacoes em `handleMessagesUpsert` (linha ~228-308):
- Antes de processar mensagem, extrair `msg.key.previousRemoteJid`
- Se `previousRemoteJid` contem @lid, atualizar conversa com `lid_jid`
- Se `isFromMe && isLid`:
  - Chamar `resolveLidToPhone` para obter JID real
  - Se nao resolver, buscar no banco: `SELECT remote_jid FROM whatsapp_conversations WHERE lid_jid = $lid AND account_id = $account`
  - Se encontrar, usar esse `remote_jid` em vez do @lid para o insert da mensagem e upsertConversation
  - Se nao encontrar, inserir mensagem com @lid mas pular upsertConversation

**Arquivo: `src/hooks/use-conversations.tsx`**

- Na funcao `fetchConversations` (linha ~60), adicionar filtro `.not('remote_jid', 'like', '%@lid')` para excluir conversas @lid da lista
- Remover a logica de sync background (linhas ~188-201) pois `findMessages` retorna vazio

**Arquivo: Nova migracao SQL**

```sql
-- Add lid_jid column
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS lid_jid text;
CREATE INDEX IF NOT EXISTS idx_conversations_lid_jid 
  ON whatsapp_conversations(lid_jid) WHERE lid_jid IS NOT NULL;

-- Cleanup: delete @lid conversations (messages will remain orphaned but harmless)
DELETE FROM whatsapp_conversations WHERE remote_jid LIKE '%@lid';
```

### Resultado esperado

1. Mensagens enviadas pelo celular aparecerao na mesma conversa das mensagens recebidas
2. Nao serao criadas mais conversas fantasma "Anz Imoveis"
3. A lista de conversas mostrara apenas conversas reais com contatos
4. O historico completo (enviado + recebido) aparecera unificado no chat
