

## Correcao: Mensagens enviadas pelo celular nao aparecem no chat

### Problema identificado

Investigando o banco de dados da conversa com **Karla Jeanne**, existem 19 mensagens armazenadas, sendo **apenas 1 com `is_from_me: true`** (a saudacao inicial enviada pelo CRM). Todas as respostas que o Bruno enviou pelo celular nao estao no banco de dados.

**Causa raiz:** A Evolution API nao dispara eventos webhook (`messages.upsert`) para mensagens enviadas diretamente pelo aplicativo WhatsApp no celular. O evento `SEND_MESSAGE` so e disparado para mensagens enviadas via API (pelo CRM). Isso significa que qualquer mensagem que o usuario digita no celular nunca chega ao webhook e nunca e armazenada.

**Evidencia:** Os logs do webhook mostram apenas eventos `messages.upsert` com `fromMe: false`. Nenhum evento de mensagem enviada pelo celular foi registrado.

### Solucao

Implementar uma sincronizacao de mensagens usando o endpoint `POST /chat/findMessages/{instance}` da Evolution API. Quando o usuario abrir uma conversa, o sistema busca as mensagens diretamente da Evolution API e armazena as que estiverem faltando no banco.

### Etapas

**1. Criar edge function `whatsapp-sync-messages`**

Essa funcao recebe o `remote_jid` do chat, consulta a Evolution API para obter as mensagens reais e insere no banco qualquer mensagem que esteja faltando (identificada pelo `message_id`).

```text
Fluxo:
  Frontend abre conversa
  -> Chama whatsapp-sync-messages com remote_jid
  -> Edge function consulta Evolution API: POST /chat/findMessages/{instance}
     body: { "where": { "key": { "remoteJid": "..." } } }
  -> Compara mensagens retornadas com as existentes no banco (por message_id)
  -> Insere as que faltam (especialmente as is_from_me: true do celular)
  -> Retorna contagem de mensagens sincronizadas
```

**2. Adicionar ao `config.toml`**

```toml
[functions.whatsapp-sync-messages]
verify_jwt = true
```

**3. Modificar o hook `useMessages` em `src/hooks/use-conversations.tsx`**

Adicionar uma chamada a `whatsapp-sync-messages` antes de buscar as mensagens do banco. A sincronizacao acontece em paralelo com o carregamento das mensagens locais, e quando termina, refaz a busca para incluir as novas.

```typescript
// Dentro de fetchMessages, antes do select:
// 1. Disparar sync em background
supabase.functions.invoke('whatsapp-sync-messages', {
  body: { remote_jid: remoteJid }
}).then(result => {
  if (result.data?.synced > 0) {
    // Re-fetch to include newly synced messages
    refetchFromDB();
  }
});
// 2. Carregar mensagens locais normalmente (resposta instantanea)
```

### Secao tecnica

**Arquivo: `supabase/functions/whatsapp-sync-messages/index.ts`** (novo)

A edge function:
- Recebe `remote_jid` no body
- Busca o `account_id` do usuario autenticado
- Busca a sessao WhatsApp conectada da conta
- Chama `POST {EVOLUTION_API_URL}/chat/findMessages/{instance_name}` com `{ "where": { "key": { "remoteJid": remote_jid } } }`
- Para cada mensagem retornada, verifica se ja existe no banco por `message_id`
- Insere as mensagens faltantes com `is_from_me`, `content`, `timestamp`, `media_type` etc.
- Retorna `{ synced: N }` com a contagem de mensagens inseridas

**Arquivo: `src/hooks/use-conversations.tsx`** (modificar `useMessages`)

Adicionar chamada de sincronizacao no `fetchMessages`:
- Antes de buscar do Supabase, dispara `whatsapp-sync-messages` em background
- Se a sync retornar `synced > 0`, refaz o select para incluir as novas mensagens
- A UI carrega instantaneamente com os dados locais, e atualiza automaticamente se houver novas mensagens sincronizadas

**Arquivo: `supabase/config.toml`**

Adicionar entrada para a nova funcao.

### Resultado esperado

1. Ao abrir qualquer conversa, o sistema busca automaticamente as mensagens da Evolution API
2. Mensagens enviadas pelo celular do usuario serao sincronizadas e exibidas no chat
3. A experiencia e instantanea - as mensagens locais aparecem primeiro, e as novas sao adicionadas em seguida
4. O problema de mensagens "faltando" sera resolvido para todas as conversas, nao apenas para a Karla Jeanne
