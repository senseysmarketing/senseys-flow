

## Corrigir mensagem de erro do WhatsApp no modal do lead

### Problema
O `error_message` armazenado na `whatsapp_message_queue` vem diretamente da Evolution API em ingles ("Failed to send message"). O frontend so verifica frases em portugues, entao exibe o texto cru em ingles.

### Solucao

Corrigir em **2 camadas** para garantir robustez:

### 1. Backend - `process-whatsapp-queue/index.ts`
Quando o `whatsapp-send` retorna erro (especialmente `invalid_number: true`), gravar a `error_message` em portugues: **"Este numero nao existe no WhatsApp"** em vez do texto cru da API.

### 2. Frontend - `LeadDetailModal.tsx`
Expandir a condicao de deteccao para cobrir tambem mensagens em ingles como "Failed to send message", "not exist", "not registered", garantindo que qualquer variacao mostre o texto amigavel: **"Este numero nao existe no WhatsApp"**.

Mesma logica nos tooltips de `LeadKanbanCard.tsx`, `LeadMobileCard.tsx` e `LeadsTable.tsx`.

---

### Detalhes tecnicos

**Arquivos a modificar:**

1. **`supabase/functions/process-whatsapp-queue/index.ts`**
   - Na secao onde grava o `error_message` apos falha, substituir a mensagem generica por "Este numero nao existe no WhatsApp" quando `invalid_number` for `true`

2. **`src/components/LeadDetailModal.tsx`** (linha ~322)
   - Expandir a condicao para incluir: `'failed to send'`, `'not exist'`, `'not registered'`
   - Texto exibido: "Este numero nao existe no WhatsApp. Verifique o telefone do lead."

3. **`src/components/LeadKanbanCard.tsx`**, **`src/components/leads/LeadMobileCard.tsx`**, **`src/components/leads/LeadsTable.tsx`**
   - Mesma expansao da condicao nos tooltips

4. **`src/hooks/use-whatsapp-failures.tsx`**
   - Atualizar o fallback default de "Falha no envio" para normalizar mensagens em ingles antes de armazena-las no Map

