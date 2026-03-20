

## Corrigir Duplicação de Atividade "Status Alterado" no WhatsApp Webhook

### Problema
Quando um lead responde via WhatsApp e é movido de "Novo Lead" para "Em Contato":
1. O **webhook** faz `UPDATE leads SET status_id = ...` e depois insere manualmente uma atividade com descrição "Lead respondeu via WhatsApp - movido automaticamente para Em Contato"
2. O **trigger do banco** (`track_lead_changes`) detecta a mudança de `status_id` e insere automaticamente outra atividade "Status alterado por Sistema"

Resultado: duas entradas redundantes na timeline.

### Solução
Remover o INSERT manual de `lead_activities` do `whatsapp-webhook/index.ts` (linhas 601-610) e, em vez disso, melhorar a descrição que o trigger gera para chamadas do sistema.

Para isso:
1. **No `whatsapp-webhook/index.ts`**: Remover o bloco de insert manual na `lead_activities` (linhas 601-617). O trigger já cuida disso.
2. **No trigger `track_lead_changes`**: Alterar a descrição para ser mais informativa quando `user_id IS NULL` (chamadas do sistema/service_role). Em vez de "Status alterado por Sistema", usar "Lead respondeu via WhatsApp - movido automaticamente".

Porém, o trigger não sabe **por que** o status mudou (se foi WhatsApp, IA, etc). A abordagem mais limpa:

**Abordagem final**: Remover apenas o INSERT manual do webhook, mantendo o trigger como fonte única. A descrição "Status alterado por Sistema" é suficiente e não redundante.

### Arquivo modificado
- `supabase/functions/whatsapp-webhook/index.ts` — Remover linhas 601-617 (o insert manual + error handling da atividade), mantendo apenas o log do console

### Detalhes Técnicos
- O trigger `track_lead_changes` já captura toda mudança de `status_id` automaticamente
- A mesma correção deve ser aplicada à edge function `ai-funnel-advance/index.ts` que também faz insert manual (mas essa foi criada recentemente sabendo do trigger — verificar se há duplicação lá também)

