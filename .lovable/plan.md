

## Aviso de numero invalido no WhatsApp

### Problema
Quando um lead tem um numero que nao possui WhatsApp, a mensagem automatica falha silenciosamente. O usuario nao recebe nenhum feedback visual e reclama que "a mensagem nao foi enviada", sem saber que o problema e o numero.

### Solucao

Adicionar avisos visuais em **3 pontos estrategicos**:

---

### 1. Alerta no modal de detalhes do lead (LeadDetailModal)

Quando o lead tem mensagens falhadas na fila (`whatsapp_message_queue` com `status = 'failed'`), exibir um banner de alerta amarelo/vermelho logo abaixo das informacoes de contato, similar ao alerta de "Lead Recorrente" que ja existe:

- Icone de alerta + texto: "Falha no envio de WhatsApp"
- Mostrar a mensagem de erro (`error_message` da fila)
- Se o erro contem indicacao de numero invalido (ex: `exists: false`), exibir texto amigavel: "Este numero nao possui WhatsApp ativo"

### 2. Indicador na tabela/card de leads

Adicionar um pequeno icone de alerta (triangulo amarelo) ao lado do botao de WhatsApp nos cards/tabela de leads quando houver mensagem falhada para aquele lead. Isso dara visibilidade imediata sem precisar abrir o modal.

### 3. Melhoria no backend (whatsapp-send)

Atualizar a edge function `whatsapp-send` para:
- Detectar quando a resposta da Evolution API indica `exists: false`
- Salvar uma `error_message` mais descritiva (ex: "Numero nao possui WhatsApp") no `whatsapp_message_queue`
- Marcar como `failed` permanentemente (sem retry) quando o numero nao existe, evitando tentativas inuteis

---

### Detalhes tecnicos

**Arquivos a modificar:**

1. **`supabase/functions/whatsapp-send/index.ts`**
   - Apos receber resposta da Evolution API, verificar se o numero nao existe
   - Se `exists: false` ou erro similar, retornar erro especifico com flag `invalid_number: true`
   - Salvar `error_message` descritiva no log

2. **`supabase/functions/process-whatsapp-queue/index.ts`**
   - Quando `whatsapp-send` retorna `invalid_number: true`, marcar como `failed` imediatamente (sem retry)
   - Salvar `error_message`: "Numero nao possui WhatsApp"

3. **`src/components/LeadDetailModal.tsx`**
   - Adicionar `useEffect` para buscar mensagens falhadas do lead na `whatsapp_message_queue`
   - Renderizar alerta visual quando houver falha, com mensagem amigavel

4. **`src/components/LeadKanbanCard.tsx`** e **`src/components/leads/LeadMobileCard.tsx`**
   - Consultar se ha mensagem falhada para o lead
   - Mostrar icone de alerta discreto junto ao botao WhatsApp

5. **`src/components/leads/LeadsTable.tsx`**
   - Mesmo indicador visual na coluna de acoes/WhatsApp

### Fluxo do aviso

```text
Lead chega -> Mensagem enfileirada -> whatsapp-send tenta enviar
                                          |
                                    Numero invalido?
                                     /          \
                                   Sim           Nao
                                    |             |
                              status: failed   Envia normalmente
                              error: "Numero    
                              sem WhatsApp"     
                              (sem retry)       
                                    |
                              Frontend detecta
                              e mostra alerta
                              no card + modal
```

