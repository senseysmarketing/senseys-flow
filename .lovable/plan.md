

## Problema: Alerta de falha WhatsApp nao aparece

### Causa raiz

Os hooks `useLeadWhatsAppFailure` e `useWhatsAppFailures` consultam apenas a tabela `whatsapp_message_queue` (sistema legado). Porem, o sistema atual de automacao registra falhas na tabela `whatsapp_message_log` com `delivery_status = 'failed'`. Como o Maxwel Marques nunca teve registro na tabela legada, o alerta nao aparece.

### Solucao

Modificar os dois hooks em `src/hooks/use-whatsapp-failures.tsx` para tambem consultar `whatsapp_message_log`:

**`useLeadWhatsAppFailure`** (modal de detalhe do lead):
- Adicionar uma segunda query em paralelo: `whatsapp_message_log` com `delivery_status = 'failed'` e `send_type = 'automation'`
- Usar o resultado de qualquer uma das tabelas (legada ou nova) para determinar falha
- Extrair `error_message` da tabela legada ou inferir "Número não possui WhatsApp" da nova (onde o campo relevante seria o conteudo do log)

**`useWhatsAppFailures`** (lista/kanban de leads):
- Mesma logica: consultar ambas as tabelas e fazer merge dos resultados
- Priorizar erro da tabela legada se existir em ambas

### Arquivo a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/use-whatsapp-failures.tsx` | Adicionar consulta a `whatsapp_message_log` nos dois hooks, fazendo merge com resultados da tabela legada |

### Mudanca principal

```typescript
// useLeadWhatsAppFailure - adicionar query ao whatsapp_message_log
const [queueResult, logResult, sessionResult] = await Promise.all([
  // Legado
  supabase.from('whatsapp_message_queue').select('error_message')
    .eq('lead_id', leadId).eq('status', 'failed')
    .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  // Novo sistema
  supabase.from('whatsapp_message_log').select('delivery_status')
    .eq('lead_id', leadId).eq('delivery_status', 'failed')
    .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  // Sessao
  accountId ? supabase.from('whatsapp_sessions')... : ...
])

const hasFailed = !!queueResult.data || !!logResult.data
const errorMsg = queueResult.data?.error_message || 'Número não possui WhatsApp'
```

Mesma abordagem para `useWhatsAppFailures` (bulk).

