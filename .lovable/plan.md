

## Automacao de Follow-up para Leads sem Resposta

### Conceito

Adicionar uma cadeia de follow-ups automaticos abaixo da saudacao existente. O sistema detecta leads que receberam a saudacao mas **nao responderam** dentro de um periodo configuravel, e envia mensagens de acompanhamento em etapas progressivas.

### Como Vai Funcionar

1. O usuario configura **etapas de follow-up** (ex: 1h, 24h, 72h apos a saudacao)
2. Cada etapa tem sua propria **mensagem/template** e **delay**
3. Quando a saudacao e enviada, o sistema agenda os follow-ups na fila (`whatsapp_message_queue`)
4. Se o lead **responder** (detectado pelo webhook), todos os follow-ups pendentes sao **cancelados automaticamente**
5. Se o lead **mudar de status** (ex: saiu de "Novo Lead"), os follow-ups tambem sao cancelados

### Mudancas no Banco de Dados

**Nova tabela: `whatsapp_followup_steps`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| account_id | uuid | FK para accounts |
| name | text | Nome da etapa (ex: "Follow-up 1h") |
| template_id | uuid | FK para whatsapp_templates |
| delay_minutes | integer | Tempo apos a saudacao (em minutos) |
| position | integer | Ordem da etapa (1, 2, 3...) |
| is_active | boolean | Ativar/desativar etapa individual |
| created_at | timestamptz | Default now() |

**Coluna nova na `whatsapp_message_queue`:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| followup_step_id | uuid (nullable) | FK para whatsapp_followup_steps -- identifica que esta mensagem e um follow-up |

Isso permite diferenciar mensagens de saudacao de follow-ups e cancelar follow-ups pendentes quando o lead responde.

### Logica de Cancelamento (Chave do Sistema)

No **webhook de mensagens recebidas** (`whatsapp-webhook/index.ts`), quando uma resposta e detectada:

```text
Lead respondeu
    |
    v
Buscar mensagens pendentes na fila com:
  - lead_id = lead que respondeu
  - status = 'pending'
  - followup_step_id IS NOT NULL (so follow-ups)
    |
    v
Atualizar status para 'cancelled'
```

### Agendamento dos Follow-ups

No momento em que a **saudacao e enviada com sucesso** (no `process-whatsapp-queue`), o sistema:

1. Verifica se a mensagem enviada e uma saudacao (automation_rule com trigger_type = 'new_lead')
2. Busca as etapas de follow-up ativas da conta
3. Para cada etapa, insere uma mensagem na fila com `scheduled_for = agora + delay_minutes` e `followup_step_id` preenchido

### Interface (no WhatsAppIntegrationSettings)

Logo abaixo da secao de "Saudacao Automatica", uma nova secao:

**"Follow-up Automatico"**
- Switch para ativar/desativar o sistema de follow-ups
- Lista de etapas configuradas, cada uma com:
  - Tempo de espera (select: 1h, 2h, 6h, 12h, 24h, 48h, 72h)
  - Template da mensagem (select dos templates existentes)
  - Switch individual de ativar/desativar
  - Botao de remover etapa
- Botao "Adicionar Etapa" para criar novas etapas
- Texto informativo: "Follow-ups sao cancelados automaticamente quando o lead responde"

### Arquivos a Modificar

1. **Nova migracao SQL** - criar tabela `whatsapp_followup_steps` + adicionar coluna `followup_step_id` na `whatsapp_message_queue`
2. **`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** - nova secao de UI para configurar etapas de follow-up
3. **`supabase/functions/process-whatsapp-queue/index.ts`** - apos enviar saudacao com sucesso, agendar follow-ups
4. **`supabase/functions/whatsapp-webhook/index.ts`** - ao receber resposta, cancelar follow-ups pendentes
5. **`src/integrations/supabase/types.ts`** - adicionar tipos da nova tabela

### Fluxo Completo

```text
Lead entra -> Saudacao enviada
    |
    v
Agendar Follow-ups: [1h, 24h, 72h]
    |
    v
Lead respondeu? ----Sim----> Cancelar follow-ups pendentes
    |                          + Mover para "Em Contato"
    Nao
    |
    v
1h: Enviar Follow-up 1
    |
    v
Lead respondeu? ----Sim----> Cancelar restantes
    |
    Nao
    |
    v
24h: Enviar Follow-up 2
    |
    v
72h: Enviar Follow-up 3 (ultimo)
```

### Detalhes Tecnicos

- Os follow-ups usam a mesma infraestrutura de fila (`whatsapp_message_queue`) e processador (`process-whatsapp-queue`) que ja existe
- A diferenciacao e feita pela coluna `followup_step_id` -- se preenchida, e follow-up; se null, e saudacao ou envio manual
- O cancelamento no webhook e uma unica query UPDATE que marca como 'cancelled' todas as mensagens pendentes com followup_step_id para aquele lead
- Nao e necessario criar um novo cron job -- o processador existente ja lida com mensagens agendadas para o futuro

