

## Corrigir Recebimento de Mensagens WhatsApp - Diagnostico Completo

### Problema Confirmado

Analisando os logs detalhadamente:

1. As correcoess anteriores (formatos multiplos no `handleMessagesUpsert` e `handleMessagesUpdate`) foram aplicadas ao codigo, **mas o deploy so completou APOS os testes do usuario** -- os logs de `messages.upsert` das 17:02 UTC ainda mostram o formato antigo (sem "data type:"), confirmando que o codigo antigo processou essas mensagens.

2. O codigo antigo fazia `data?.messages || []` -- se a Evolution API envia a mensagem numa estrutura diferente (ex: `data` e o proprio objeto de mensagem, ou `data` contem propriedades como `key`, `pushName`, `message`, etc. no nivel raiz), o resultado era um array vazio e a mensagem era silenciosamente descartada.

3. Nao temos nenhum log que mostre a estrutura real do payload recebido da Evolution API para `messages.upsert`.

### Plano de Acao

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

**1. Adicionar log do payload bruto (prioridade maxima)**

No inicio de `handleMessagesUpsert`, antes de qualquer processamento, adicionar:

```text
console.log('[whatsapp-webhook] messages.upsert raw data:', JSON.stringify(data).substring(0, 2000))
```

Isso nos dara visibilidade total da estrutura enviada pela Evolution API.

**2. Adicionar log do payload no handler principal**

No switch/case do evento, antes de chamar `handleMessagesUpsert`, logar o payload completo:

```text
case 'messages.upsert':
  console.log('[whatsapp-webhook] messages.upsert full payload keys:', JSON.stringify(Object.keys(data || {})))
  await handleMessagesUpsert(supabase, session, data)
  break
```

**3. Garantir deploy e testar**

Apos o deploy, solicitar que voce envie uma nova mensagem de resposta do lead para capturar os logs com a estrutura real do payload. Com essa informacao, poderemos ajustar o parser definitivamente.

**4. Possivel correcao adicional baseada na Evolution API v2**

Baseado na documentacao da Evolution API, o formato mais provavel para `messages.upsert` e:

```text
{
  "event": "messages.upsert",
  "instance": "...",
  "data": {
    "key": { "remoteJid": "...", "fromMe": false, "id": "..." },
    "pushName": "Leo Henry",
    "message": { "conversation": "opa" },
    "messageTimestamp": 1707480000,
    "status": "DELIVERY_ACK"
  }
}
```

Nesse caso, `data` e diretamente o objeto da mensagem (com `key` no nivel raiz). A correcao anterior ja cobre esse caso com `data?.key -> messages = [data]`, **mas precisamos confirmar com os logs**.

### Resumo das Alteracoes

- Adicionar 2 linhas de log para capturar o payload bruto da Evolution API
- Fazer deploy imediato
- Pedir um novo teste de envio de mensagem do lead
- Com o log, ajustar o parser se necessario

### Detalhes Tecnicos

A alteracao e minima (2 linhas de console.log). Apos capturar a estrutura real do payload, faremos a correcao definitiva se o formato nao for coberto pelo parser atual.

