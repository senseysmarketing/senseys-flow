
## Aviso de Mensagem Programada no Modal de Detalhes do Lead

### Confirmacao: Sistema de Horario Comercial Funcionando

O lead **Daniel Garcia Neto** chegou em **21/02 (sabado) as 03:27 (horario SP)**. A configuracao da conta Senseys e **08h-18h, Seg-Sex**. A mensagem de saudacao foi corretamente reprogramada para **23/02 (segunda-feira) as 08:00 (horario SP)**. Tudo funcionando como esperado.

### O que sera implementado

Um novo alerta informativo no modal de detalhes do lead (e tambem no painel lateral de conversas) que mostra as proximas mensagens de WhatsApp programadas para aquele lead. O visual sera semelhante ao alerta de falha de WhatsApp ja existente, mas com tom informativo (azul/primary).

O alerta mostrara:
- Icone de relogio/agendamento
- Titulo "Mensagem programada"
- Data e hora da proxima mensagem (em horario de Sao Paulo)
- Nome/tipo da mensagem (ex: "Saudacao para Novos Leads")
- Se houver mais mensagens, indicar quantas estao na fila (ex: "+2 follow-ups agendados")

### Arquivos que serao alterados

**1. Novo hook: `src/hooks/use-scheduled-messages.tsx`**

Hook reutilizavel que consulta a tabela `whatsapp_message_queue` para um lead especifico, retornando mensagens com status `pending` ordenadas por `scheduled_for`. Retorna:
- `nextMessage`: proxima mensagem (scheduled_for, message, automation_rule_id)
- `totalPending`: total de mensagens pendentes
- `loading`: estado de carregamento

A query buscara tambem o nome da regra de automacao (`whatsapp_automation_rules.name`) para exibir o tipo da mensagem.

**2. `src/components/LeadDetailModal.tsx`**

Adicionar o alerta de mensagem programada logo apos os alertas de WhatsApp existentes (linhas 315-347). Usara o novo hook `useScheduledMessages(lead.id)`. O alerta aparecera apenas quando houver mensagens pendentes.

Visual proposto:
```
[Clock icon] Mensagem programada
Saudacao para Novos Leads - Envio em 23 de fevereiro as 08:00
+0 follow-ups agendados
```

Estilo: `border-primary/30 bg-primary/10` com icone em cor primary, semelhante ao padrao dos outros alertas.

**3. `src/components/conversations/LeadPanel.tsx`**

Adicionar o mesmo alerta na secao de detalhes do lead no painel lateral de conversas, logo antes do Separator apos o nome/status. Usara o mesmo hook.

**4. `src/components/leads/LeadMobileCard.tsx`**

Adicionar um pequeno indicador visual (icone de relogio) no card mobile quando o lead tiver mensagens programadas, similar ao indicador de erro de WhatsApp ja existente.

### Detalhes Tecnicos

- A consulta ao banco usara `whatsapp_message_queue` com filtro `lead_id = X` e `status = 'pending'`, ordenado por `scheduled_for ASC`
- Para obter o nome da regra, fara um join com `whatsapp_automation_rules` via `automation_rule_id`
- O horario sera formatado em `pt-BR` com timezone `America/Sao_Paulo` usando `toLocaleString`
- O hook usara `useEffect` com dependencia no `leadId` para buscar os dados quando o modal abrir
- Para o LeadMobileCard, sera criado um hook em batch (`useScheduledMessagesMap`) que aceita array de lead_ids, similar ao `useWhatsAppFailures`
