

## Correcao: Mensagens recebidas nao aparecem na tela de conversas

### Problema identificado

As mensagens dos usuarios **estao sendo recebidas e salvas corretamente** no banco de dados pela Evolution API. O problema e que o WhatsApp/Evolution API usa formatos de numero diferentes para mensagens enviadas e recebidas:

- Mensagens **enviadas**: `remote_jid = 5541995787864@s.whatsapp.net` (com nono digito)
- Mensagens **recebidas**: `remote_jid = 554195787864@s.whatsapp.net` (sem nono digito)

Como a conversa e criada com o JID da primeira mensagem (geralmente enviada), e o frontend filtra mensagens por `remote_jid` exato, as mensagens recebidas com JID diferente ficam invisiveis.

### Causa raiz

A numeracao brasileira tem o nono digito (`9`) em celulares, mas o WhatsApp internamente pode armazenar/enviar JIDs com ou sem esse digito. A funcao `extractPhoneFromJid` apenas limpa o sufixo do JID mas nao normaliza o numero.

### Plano de correcao

**1. Normalizar o JID no webhook (backend)**

Na edge function `whatsapp-webhook/index.ts`, criar uma funcao `normalizeJid` que padroniza numeros brasileiros para sempre incluir o nono digito. Isso garante que mensagens enviadas e recebidas usem o mesmo `remote_jid`.

```text
Regra: Se o numero comeca com 55 (Brasil) + 2 digitos DDD + 8 digitos (falta o 9),
inserir o 9 apos o DDD para normalizar para 13 digitos.
Exemplo: 554195787864 -> 5541995787864
```

**2. Aplicar normalizacao em `handleMessagesUpsert`**

Antes de salvar a mensagem e atualizar a conversa, normalizar tanto o `phone` quanto o `remoteJid` para o formato padrao.

**3. Corrigir dados existentes no banco**

Executar uma query de correcao para unificar mensagens e conversas que foram salvas com JIDs diferentes para o mesmo contato.

### Secao tecnica

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Adicionar funcao de normalizacao:

```typescript
function normalizeBrazilianJid(jid: string): string {
  const phone = extractPhoneFromJid(jid);
  // Brazilian numbers: country code (55) + DDD (2 digits) + number (8 or 9 digits)
  // If 12 digits (55 + DD + 8 digits), insert 9 after DDD
  if (phone.length === 12 && phone.startsWith('55')) {
    const ddd = phone.slice(2, 4);
    const number = phone.slice(4);
    const normalized = `55${ddd}9${number}`;
    const suffix = jid.includes('@') ? '@' + jid.split('@')[1] : '@s.whatsapp.net';
    return normalized + suffix;
  }
  return jid;
}
```

Na funcao `handleMessagesUpsert`, apos extrair o `remoteJid`:

```typescript
const rawRemoteJid = msg.key?.remoteJid;
if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us') || rawRemoteJid === 'status@broadcast') continue;

const remoteJid = normalizeBrazilianJid(rawRemoteJid);
const phone = extractPhoneFromJid(remoteJid);
```

**Arquivo: `src/hooks/use-conversations.tsx`**

No hook `useMessages`, adicionar normalizacao ao filtrar por `remote_jid` para garantir compatibilidade com dados antigos:

```typescript
const fetchMessages = useCallback(async () => {
  if (!accountId || !remoteJid) { setMessages([]); return; }
  setLoading(true);
  
  // Buscar por ambos os formatos de JID (com e sem nono digito)
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
  const phoneSuffix = phone.slice(-8); // ultimos 8 digitos
  
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('...')
    .eq('account_id', accountId)
    .ilike('remote_jid', `%${phoneSuffix}%`)
    .order('timestamp', { ascending: true })
    .limit(200);
  // ...
}, [accountId, remoteJid]);
```

Mesma logica no realtime subscription - comparar por sufixo do telefone em vez de JID exato.

**Correcao de dados existentes (SQL one-time fix):**

```sql
-- Atualizar mensagens com JID de 12 digitos para incluir o nono digito
UPDATE whatsapp_messages 
SET remote_jid = '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5) || '@s.whatsapp.net',
    phone = '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5)
WHERE phone ~ '^55[0-9]{2}[0-9]{8}$' 
  AND length(phone) = 12
  AND remote_jid LIKE '%@s.whatsapp.net';
```

### Resultado esperado

Apos a correcao:
- Todas as mensagens (enviadas e recebidas) terao o mesmo `remote_jid` normalizado
- A tela de conversas exibira corretamente mensagens de ambos os lados
- O realtime continuara funcionando para novas mensagens
- Dados antigos serao corrigidos pela query SQL

