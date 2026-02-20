
## Sistema de Horário Comercial para Envio de WhatsApp

### Visão Geral

A ideia é excelente e resolve um problema real de experiência do lead — ninguém quer receber mensagens automatizadas de madrugada ou no fim de semana. O sistema funcionará assim:

- O usuário configura os **horários permitidos** (ex: 08h–18h) e os **dias da semana** (ex: seg–sex)
- Ao enfileirar uma mensagem (saudação ou follow-up), o sistema calcula se o horário agendado cai dentro da janela permitida
- Se não cair, reprograma automaticamente para o **próximo momento válido mais próximo**
- Todo o cálculo usa o **fuso de São Paulo (America/Sao_Paulo)** para evitar distorções de horário

---

### Arquitetura da Solução

**1. Nova tabela: `whatsapp_sending_schedule`**

Armazena a configuração de horário comercial por conta:

```sql
CREATE TABLE whatsapp_sending_schedule (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      uuid NOT NULL UNIQUE,
  is_enabled      boolean DEFAULT false,          -- on/off da feature
  start_hour      integer DEFAULT 8,              -- hora início (0-23)
  end_hour        integer DEFAULT 18,             -- hora fim (0-23)
  allowed_days    integer[] DEFAULT '{1,2,3,4,5}', -- 0=Dom, 1=Seg...6=Sáb
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

**Por que UNIQUE em `account_id`**: cada conta tem apenas uma configuração global de horário.

---

**2. Função utilitária na Edge Function: `getNextValidSendTime`**

Implementada diretamente no `process-whatsapp-queue`, esta função recebe um timestamp e a configuração de horário comercial, e retorna o próximo momento válido para envio:

```
Lógica:
1. Converte o horário proposto para São Paulo (UTC-3)
2. Verifica se o dia da semana está na lista de dias permitidos
3. Verifica se a hora atual está dentro da janela (start_hour <= hora < end_hour)
4. Se sim → retorna o mesmo timestamp (pode enviar agora)
5. Se a hora já passou do fim do dia → avança para o próximo dia permitido às start_hour
6. Se a hora ainda não chegou ao início → avança para start_hour do mesmo dia
7. Se o dia não é permitido → avança dia a dia até encontrar um dia permitido
```

**Exemplo prático:**
- Configuração: 08h–18h, Seg–Sex
- Mensagem agendada para: Sexta 19h30
- Resultado: Segunda-feira 08h00

---

**3. Ponto de integração na Edge Function**

A lógica de ajuste de horário é aplicada em **dois momentos** dentro do `process-whatsapp-queue`:

**A) Ao processar mensagens da fila:** antes de verificar se pode enviar, aplica a função. Se o horário atual não é válido, reprograma a mensagem e pula para a próxima.

**B) Ao agendar follow-ups:** após enviar a saudação com sucesso, ao calcular `scheduled_for` dos follow-ups (`now + delay_minutes`), aplica `getNextValidSendTime` no horário calculado antes de inserir na fila.

---

**4. UI de configuração na aba WhatsApp**

Uma nova seção "Horário de Envio" será adicionada ao componente `WhatsAppIntegrationSettings.tsx` dentro do card de configuração global, acima das saudações. Conterá:

- **Toggle** para ativar/desativar o controle de horário
- **Seletor de horário início e fim** (dropdowns de hora em hora, 00h–23h)
- **Checkboxes dos dias da semana** (Dom, Seg, Ter, Qua, Qui, Sex, Sáb)
- **Preview da janela configurada** ("Mensagens serão enviadas de Seg a Sex, das 08h às 18h")

---

### Arquivos que serão alterados

1. **Migração SQL** — Cria a tabela `whatsapp_sending_schedule` com RLS adequado
2. **`supabase/functions/process-whatsapp-queue/index.ts`** — Adiciona a função `getNextValidSendTime` e a integração nas duas etapas (verificação de envio e agendamento de follow-ups)
3. **`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** — Adiciona a seção de UI de configuração de horário comercial

---

### Fluxo Completo (Exemplo)

```text
Lead chega às 19h30 de uma Sexta-feira
     │
     ▼
webhook-leads enfileira mensagem de saudação
  scheduled_for = agora + delay (ex: 19h30)
     │
     ▼
process-whatsapp-queue executa (a cada minuto)
  → busca mensagem com scheduled_for <= agora
  → verifica configuração de horário da conta
  → 19h30 Sexta está fora da janela (08h–18h, Seg–Sex)
  → reprograma para Segunda 08h00
  → atualiza scheduled_for no banco
     │
     ▼
Segunda 08h00 → cron executa
  → mensagem é enviada com sucesso
  → follow-ups são agendados:
      Etapa 1: agora + 24h = Terça 08h00 ✓ (dentro da janela)
      Etapa 2: agora + 48h = Quarta 08h00 ✓
```

---

### Detalhes Técnicos

- **Fuso horário**: usa `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` — isso respeita automaticamente horário de verão quando o Brasil o adotar
- **`end_hour` é exclusivo**: configurar até 18h significa que mensagens são enviadas até 17h59, não às 18h00
- **Fallback seguro**: se a feature estiver desativada (`is_enabled = false`), o comportamento atual é mantido sem nenhuma alteração
- **Sem loop infinito**: o algoritmo itera no máximo 7 dias até encontrar um dia válido; se nenhum dia estiver configurado, retorna o timestamp original sem modificação
