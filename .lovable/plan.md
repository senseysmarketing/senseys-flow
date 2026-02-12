

## Corrigir Recebimento de Mensagens WhatsApp - Problema Real Identificado

### Diagnostico Correto

A analise do ChatGPT esta parcialmente errada:

- **Problema #1 (conversation_id): INCORRETO** - A coluna `conversation_id` nao existe na tabela `whatsapp_messages`. A UI busca mensagens por `remote_jid`, nao por `conversation_id`. Esse nao e o problema.
- **Problema #2 (ephemeralMessage): VALIDO** - Mensagens efemeras podem estar sendo ignoradas. Correcao valida.
- **Problema #3 (Realtime): IRRELEVANTE** - O realtime ja esta implementado corretamente.

### Causa Raiz Descoberta

Ao analisar os logs do webhook, **nao existe NENHUM evento `messages.upsert` para a instancia do usuario** (`senseys_05f41011_8143_4a71_a3ca_8f42f043ab8c`). Todos os eventos de mensagem nos logs sao de outras contas.

Isso significa que a **Evolution API nao esta enviando callbacks de webhook** para esta instancia. O webhook provavelmente perdeu a configuracao ou nunca foi configurado corretamente.

- **Por que o envio funciona?** Porque `whatsapp-send` chama a Evolution API diretamente e salva a mensagem no banco localmente.
- **Por que o recebimento nao funciona?** Porque depende da Evolution API chamar o webhook (`whatsapp-webhook`), o que nao esta acontecendo.

### Plano de Correcao

**1. Reconfigurar webhook automaticamente ao verificar status (Correcao Principal)**

Arquivo: `supabase/functions/whatsapp-connect/index.ts`

No case `status`, quando detectar que a instancia esta conectada (`state === 'open'`), reconfigurar automaticamente o webhook da Evolution API:

```text
case 'status':
  // ... apos verificar que esta conectado ...
  if (isConnected) {
    // Reconfigurar webhook para garantir que esta ativo
    try {
      await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          events: [
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED', 
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE'
          ]
        }),
      })
      console.log('[whatsapp-connect] Webhook reconfigured for', instanceName)
    } catch (e) {
      console.log('[whatsapp-connect] Error reconfiguring webhook:', e)
    }
  }
```

Isso garante que toda vez que a pagina de Configuracoes carregar (que chama `status`), o webhook sera reconfigurado.

**2. Adicionar acao dedicada "reconfigure-webhook"**

Arquivo: `supabase/functions/whatsapp-connect/index.ts`

Adicionar um novo case no switch para permitir reconfiguracao manual:

```text
case 'reconfigure-webhook':
  // Reconfigurar webhook na Evolution API
  const webhookResponse = await fetch(
    `${EVOLUTION_API_URL}/webhook/set/${instanceName}`, 
    { ... }
  )
  // Retornar resultado
```

**3. Adicionar suporte a mensagens efemeras (Correcao Secundaria)**

Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

Na funcao `extractMessageContent`, adicionar tratamento para `ephemeralMessage`:

```text
// Antes dos checks existentes, adicionar:
if (msg.message?.ephemeralMessage?.message) {
  // Recursivamente extrair conteudo da mensagem efemera
  return extractMessageContent({ 
    ...msg, 
    message: msg.message.ephemeralMessage.message 
  })
}
```

Isso garante que mensagens efemeras (comuns em grupos e chats com modo temporario) nao sejam descartadas silenciosamente.

**4. Adicionar suporte a `viewOnceMessageV2` e `protocolMessage`**

Mais formatos que a Evolution API pode enviar:

```text
if (msg.message?.viewOnceMessageV2?.message) {
  return extractMessageContent({ 
    ...msg, 
    message: msg.message.viewOnceMessageV2.message 
  })
}
```

### Sequencia de Implementacao

1. Corrigir `whatsapp-connect` para reconfigurar webhook no status check
2. Corrigir `whatsapp-webhook` para suportar ephemeral messages
3. Fazer deploy de ambas as functions
4. Acessar a pagina de Configuracoes do WhatsApp (isso dispara o status check e reconfigura o webhook)
5. Testar enviando uma mensagem de resposta do lead

### Resultado Esperado

- O webhook sera reconfigurado automaticamente na Evolution API
- Mensagens recebidas passarao a chegar no webhook e serao salvas no banco
- O chat no CRM mostrara as respostas dos leads em tempo real
- Mensagens efemeras tambem serao capturadas

