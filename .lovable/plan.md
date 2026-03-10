

## Diagnostico: Mensagens de saudacao falhando em loop infinito

### Causa raiz (2 bugs)

**Bug 1: Deteccao de numero invalido nao funciona com a resposta atual da Evolution API**

A Evolution API retorna o campo `exists: false` dentro de uma estrutura aninhada:
```json
{"status":400,"error":"Bad Request","response":{"message":[{"jid":"...@s.whatsapp.net","exists":false,"number":"5512988063017"}]}}
```

Porem o `whatsapp-send` verifica `sendData?.exists === false` (nivel raiz), que nunca e verdadeiro com essa estrutura. Resultado: o erro 400 e classificado como "Erro temporario na conexao" ao inves de "Numero nao possui WhatsApp", e `invalid_number` nunca e retornado como `true`.

**Bug 2: Automacao retenta infinitamente quando o envio falha**

No `process-whatsapp-queue`, quando `sendResponse.ok` e false e `sendResult.invalid_number` e false, o codigo faz `throw new Error(...)`. O catch reagenda para `next_execution_at + 5min` e mantem `status = 'active'`. Nao existe limite de tentativas — a automacao fica em loop eterno.

### Impacto atual

Dados do banco confirmam o problema em escala:

| Conta | Lead | Tentativas falhas |
|-------|------|-------------------|
| Edno Cordeiro | Livia Tunala | **1.660** |
| Edno Cordeiro | Andrea | **1.519** |
| Thiago e Belisa | Cintia Nagaoka | **587** |
| Oswaldo Braz | Anni Amorim | **553** |
| Rodrigo Lima | Kamila Rodrigues | **418** |
| Thiago e Belisa | Maxwel Marques | 9 (recente) |

Essas automacoes consomem recursos do cron a cada minuto, gerando milhares de logs inuteis.

### Plano de correcao

**1. Corrigir deteccao de numero invalido no `whatsapp-send`**

Adicionar verificacao da estrutura aninhada `response.message[].exists`:

```typescript
const isInvalidNumber =
  sendData?.exists === false ||
  sendData?.response?.message?.some?.((m: any) => m.exists === false) ||  // NOVO
  sendData?.error?.includes?.('not exist') || ...
```

**2. Adicionar limite maximo de tentativas no `process-whatsapp-queue`**

Adicionar campo `retry_count` na tabela e incrementar a cada falha. Apos 5 tentativas, marcar como `failed`:

```sql
ALTER TABLE whatsapp_automation_control 
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
```

No codigo:
```typescript
if (!sendResponse.ok) {
  const newRetryCount = (record.retry_count || 0) + 1
  if (newRetryCount >= 5 || sendResult.invalid_number) {
    // Marcar como failed permanentemente
    await update({ status: 'failed', retry_count: newRetryCount })
  } else {
    // Reagendar com backoff
    await update({ status: 'active', retry_count: newRetryCount, next_execution_at: ... })
  }
  continue // NAO throw
}
```

**3. Limpar automacoes travadas existentes**

Query para marcar como `failed` todas as automacoes com mais de 5 falhas:

```sql
UPDATE whatsapp_automation_control wac
SET status = 'failed', conversation_state = 'automation_finished'
WHERE status = 'active' AND conversation_state = 'new_lead'
AND (SELECT count(*) FROM whatsapp_message_log wml 
     WHERE wml.lead_id = wac.lead_id 
     AND wml.delivery_status = 'failed' 
     AND wml.send_type = 'automation') >= 5;
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/whatsapp-send/index.ts` | Corrigir deteccao de `exists:false` aninhado |
| `supabase/functions/process-whatsapp-queue/index.ts` | Adicionar retry_count com limite de 5, tratar erro sem throw |
| Migration SQL | Adicionar coluna `retry_count`, limpar automacoes travadas |

