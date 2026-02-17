
## Corrigir exibição do histórico completo no modal de chat (caso @lid)

### Diagnóstico

No banco de dados existem 6 mensagens da conversa da Raquel Rosselli, mas apenas 2 aparecem no modal:

| Timestamp | Conteúdo | remote_jid | Aparece? |
|-----------|----------|-----------|----------|
| 17:41 | Saudação automática (enviada) | `5512996165317@s.whatsapp.net` | ✅ Sim |
| 17:42 | **"Me interessei sim. Aceita financiamento."** (resposta dela) | `276175070957762@lid` | ❌ Não |
| 18:13 | "Olá Raquel, ótima tarde." (Thiago) | `276175070957762@lid` | ❌ Não |
| 18:13 | "Aceita sim, gostaria de fazer uma simulação..." (Thiago) | `276175070957762@lid` | ❌ Não |
| 18:13 | "Prazer, Belisa." (Thiago) | `276175070957762@lid` | ❌ Não |
| 19:42 | Follow-up indevido (enviado) | `5512996165317@s.whatsapp.net` | ✅ Sim |

**Causa raiz:** O `useMessages` busca mensagens via `ilike('remote_jid', '%96165317%')` (sufixo do número de telefone). As mensagens @lid têm `remote_jid = 276175070957762@lid` que não contém o sufixo `96165317`, então nunca são encontradas.

### Solução

**Dupla estratégia de busca por `lead_id`:**

O campo `lead_id` já está preenchido corretamente em TODAS as 6 mensagens (graças à correção aplicada anteriormente). A solução é enriquecer a query do `useMessages` para buscar também por `lead_id`, unindo os resultados e removendo duplicatas.

### Detalhes técnicos

**Arquivo: `src/hooks/use-conversations.tsx`** — função `fetchMessagesFromDB`

A query atual:
```typescript
.ilike('remote_jid', `%${phoneSuffix}%`)
```

Nova lógica — duas queries paralelas, resultados unidos e ordenados:
1. Query existente por `phoneSuffix` no `remote_jid` (mantida para compatibilidade)
2. Nova query por `lead_id` quando disponível

O hook `useMessages` receberá um parâmetro adicional opcional `leadId` para habilitar a segunda busca.

**Arquivo: `src/components/leads/WhatsAppChatModal.tsx`**

Passar o `leadId` para o `useMessages` através do `conversation.lead_id`.

**Realtime também corrigido:** O handler de Realtime atual também verifica apenas o `phoneSuffix`. Precisamos adicionar uma verificação adicional: se `newMsg.lead_id === leadId`, incluir a mensagem independente do JID.

### Arquivos a modificar

1. **`src/hooks/use-conversations.tsx`**
   - `useMessages`: adicionar parâmetro opcional `leadId?: string | null`
   - `fetchMessagesFromDB`: executar query adicional por `lead_id` quando disponível, unir e desduplicar resultados por `id`
   - Handler de Realtime INSERT: também aceitar mensagem se `newMsg.lead_id === leadId`

2. **`src/components/leads/WhatsAppChatModal.tsx`**
   - Passar `leadId` para `useMessages` via segundo argumento

### Resultado esperado

Com essas mudanças, ao abrir o chat da Raquel, os 6 itens aparecerão em ordem cronológica:
1. 14:41 - Saudação automática ✅
2. 14:42 - "Me interessei sim. Aceita financiamento." (resposta dela, em cinza à esquerda) ✅
3. 15:13 - "Olá Raquel, ótima tarde." (Thiago) ✅
4. 15:13 - "Aceita sim, gostaria de fazer uma simulação..." ✅
5. 15:13 - "Prazer, Belisa." ✅
6. 16:42 - Follow-up indevido ✅

Novas mensagens (inclusive vindas via @lid) também aparecerão em tempo real corretamente.
