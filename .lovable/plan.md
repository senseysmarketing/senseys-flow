
## Ajuste nos Alertas de Falha de WhatsApp no Modal do Lead

### Problema Identificado

O hook `useLeadWhatsAppFailure` (em `src/hooks/use-whatsapp-failures.tsx`) apenas verifica se existe um registro com `status = 'failed'` na `whatsapp_message_queue`, sem considerar se o WhatsApp está conectado ou não.

Quando o WhatsApp foi conectado alguma vez e depois desconectado, as mensagens que falharam no período desconectado continuam aparecendo com o alerta genérico "Falha no envio", quando na verdade o correto seria mostrar que o WhatsApp está desconectado.

### Lógica Desejada

| Situação | Alerta no modal do lead |
|---|---|
| WhatsApp **conectado** + erro no envio | "Falha no envio de WhatsApp" com o detalhe do erro (ex: número não existe) |
| WhatsApp **desconectado** + havia mensagem falhou | "WhatsApp desconectado" — sem mencionar falha de envio |
| WhatsApp nunca conectado / sem falhas | Nenhum alerta |

### Solução

**1. Atualizar o hook `useLeadWhatsAppFailure`** para também verificar o status atual da sessão WhatsApp da conta do lead. O hook precisará:
- Buscar o status da sessão WhatsApp da conta (`whatsapp_sessions` onde `status = 'connected'`)
- Buscar a falha na `whatsapp_message_queue`
- Retornar um objeto com: `{ failure, isDisconnected, loading }`

**2. Atualizar o `LeadDetailModal.tsx`** para renderizar o alerta correto com base no novo retorno do hook:
- Se `isDisconnected` → mostrar aviso de "WhatsApp desconectado" (em azul/cinza, não âmbar)
- Se `failure` e não `isDisconnected` → mostrar o alerta de falha atual (âmbar)
- Se nenhum → não mostrar nada

Para saber o `account_id` do lead no hook, a query buscará o `account_id` via `leads` ou passará diretamente como parâmetro. A solução mais limpa é passar o `account_id` como parâmetro opcional no hook, já que `LeadDetailModal` tem acesso ao `useAccount`.

### Arquivos a modificar

**`src/hooks/use-whatsapp-failures.tsx`**:
- Adicionar parâmetro `accountId?: string` ao `useLeadWhatsAppFailure`
- Adicionar estado `isDisconnected: boolean`
- Buscar em paralelo a sessão WhatsApp e a falha da fila
- Se não houver sessão conectada **e** houver falha → `isDisconnected = true, failure = null`
- Se houver sessão conectada **e** houver falha → `isDisconnected = false, failure = <mensagem>`
- Se não houver falha → retornar ambos `null/false`

**`src/components/LeadDetailModal.tsx`**:
- Passar `account` do `useAccount()` para o hook
- Ajustar o bloco do alerta (linhas ~313-329) para dois casos:
  - `isDisconnected` → alerta informativo "WhatsApp desconectado" (ícone WifiOff, cor azul/cinza)
  - `failure` → alerta âmbar atual de "Falha no envio de WhatsApp"

### Comportamento esperado para o caso da conta "ASF" / André:
- WhatsApp desconectado → modal do lead mostra: "WhatsApp desconectado — Conecte o WhatsApp nas configurações para enviar mensagens"
- Sem o aviso de "Falha no envio" confuso

### Consideração para os cards do Kanban e tabela

Os hooks `useWhatsAppFailures` (plural, para múltiplos leads) também poderiam passar pela mesma lógica, mas seria muito custoso checar a sessão para cada lead. A abordagem mais eficiente é:
- No nível da página (`Leads.tsx`), verificar uma vez se o WhatsApp está conectado
- Passar um prop `whatsappConnected: boolean` para os cards
- No card: se desconectado, não mostrar o ícone de erro (ou mostrar ícone de desconectado diferente)

Isso será feito de forma simples: adicionar um hook `useWhatsAppConnected` (leve, apenas verifica `whatsapp_sessions`) no `Leads.tsx` e passar o resultado aos cards existentes via prop.

### Resumo dos arquivos modificados

1. **`src/hooks/use-whatsapp-failures.tsx`** — adicionar `accountId` e lógica de `isDisconnected`; adicionar export de `useWhatsAppConnected`
2. **`src/components/LeadDetailModal.tsx`** — usar `useAccount`, passar `accountId`, renderizar alertas distintos
3. **`src/pages/Leads.tsx`** — verificar conexão uma vez e passar para os cards
4. **`src/components/LeadKanbanCard.tsx`** — receber `whatsappConnected` e suprimir ícone de erro quando desconectado (ou trocar por ícone diferente)
5. **`src/components/leads/LeadMobileCard.tsx`** — mesmo ajuste do Kanban
