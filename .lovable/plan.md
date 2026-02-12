

## Corrigir Configuracao do Webhook WhatsApp - Causa Raiz ENCONTRADA

### Problema Real (Confirmado nos Logs)

O log da edge function `whatsapp-connect` revela o erro definitivo:

```
Webhook reconfigured for senseys_05f41011_8143_4a71_a3ca_8f42f043ab8c :
{"status":400,"error":"Bad Request","response":{"message":[["instance requires property \"webhook\""]]}}
```

A Evolution API esta **rejeitando** a configuracao do webhook com erro 400 porque o payload esta no formato errado. O codigo atual envia:

```text
{
  "url": "...",
  "webhook_by_events": false,
  "events": [...]
}
```

Mas a Evolution API v2 espera os campos dentro de uma propriedade `webhook`:

```text
{
  "webhook": {
    "enabled": true,
    "url": "...",
    "webhook_by_events": false,
    "events": [...]
  }
}
```

Resultado: **cada tentativa de configurar o webhook falha silenciosamente** (o codigo loga o erro mas nao o trata). Por isso o screenshot mostra webhook vazio na Evolution API.

### Segundo Problema: Casing dos Eventos

No screenshot da Evolution API, os eventos estao listados como `MESSAGES_UPSERT` (maiusculas com underscore). Porem o switch no webhook usa `messages.upsert` (minusculas com ponto).

Analisando os logs das **outras instancias que FUNCIONAM**, os eventos chegam como `messages.upsert` (com ponto, minusculas). Isso indica que a Evolution API converte internamente. Porem, para garantir robustez, o switch deve aceitar ambos os formatos.

### Plano de Correcao

**1. Corrigir formato do payload do webhook (CORRECAO PRINCIPAL)**

Arquivo: `supabase/functions/whatsapp-connect/index.ts`

Em TODOS os locais onde `webhook/set` e chamado (3 ocorrencias: no `create-instance` quando instancia ja existe, no `status`, e no `reconfigure-webhook`), corrigir o body para:

```text
body: JSON.stringify({
  webhook: {
    enabled: true,
    url: webhookUrl,
    webhook_by_events: false,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED',
      'SEND_MESSAGE'
    ]
  }
})
```

Tambem corrigir o webhook inline na criacao de instancia (`instance/create`).

**2. Aceitar ambos os formatos de evento no webhook**

Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

Normalizar o nome do evento antes do switch:

```text
// Normalizar nome do evento (MESSAGES_UPSERT -> messages.upsert)
const normalizedEvent = event?.toLowerCase().replace(/_/g, '.')
```

E usar `normalizedEvent` no switch. Isso garante compatibilidade independente do formato enviado pela Evolution API.

**3. Adicionar tratamento de erro na configuracao do webhook**

Nos locais onde `webhook/set` e chamado, verificar se a resposta indica erro e logar adequadamente em vez de silenciar.

### Arquivos Alterados

- `supabase/functions/whatsapp-connect/index.ts` - Corrigir payload do webhook em 4 locais (create, already-exists, status, reconfigure-webhook)
- `supabase/functions/whatsapp-webhook/index.ts` - Normalizar evento para aceitar ambos formatos

### Sequencia de Implementacao

1. Corrigir o formato do payload em `whatsapp-connect`
2. Adicionar normalizacao de evento em `whatsapp-webhook`
3. Deploy de ambas as functions
4. Acessar pagina de Configuracoes do WhatsApp (dispara status check que reconfigura webhook)
5. Verificar nos logs se o webhook foi configurado com sucesso (status 200)
6. Testar enviando uma mensagem de resposta do lead

### Resultado Esperado

- O webhook sera configurado com sucesso na Evolution API (sem mais erro 400)
- Mensagens recebidas dos leads chegarao ao webhook e serao salvas no banco
- O chat no CRM mostrara as respostas em tempo real
- Compatibilidade total com diferentes versoes da Evolution API

