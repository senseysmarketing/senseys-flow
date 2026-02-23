

## Correcao de Bugs no Sistema de Horario Comercial do WhatsApp

### Problemas Identificados

**Problema 1: Follow-ups enviados juntos na segunda-feira**

Confirmado com dados reais:
- **Leonardo Henry**: 3 follow-ups (24h, 48h, 72h) criados quinta-feira. Cada um caiu em sexta, sabado, domingo. O `getNextValidSendTime` reagendou TODOS para segunda 08:00 SP. Resultado: 3 mensagens enviadas em 2 segundos.
- **Salomao Teste**: Mesmo problema — FU1 e FU2 enviados juntos na segunda.

**Causa raiz**: O calculo de follow-ups usa `now + delay_minutes` para CADA etapa de forma independente. Quando todos caem fora do horario comercial, `getNextValidSendTime` colapsa todos para o mesmo horario (segunda 08:00). A correcao e calcular os follow-ups **sequencialmente** — cada follow-up deve ser calculado com base no horario ajustado do follow-up anterior, nao a partir de `now`.

**Problema 2: Sequencia de saudacao nao enviada**

O lead Daniel Garcia recebeu apenas 1 mensagem de saudacao, mas a regra tem 3 etapas de sequencia configuradas. Analisando os dados:
- A mensagem criada tem o campo `message` preenchido (texto substituido), indicando que passou pelo branch de "mensagem unica" (linha 707-735 do webhook-leads), nao pelo branch de sequencia (linha 689-706, que insere com `message: ''`).
- Isso indica que no momento em que o lead chegou, a sequencia nao foi detectada pela query. Possivel causa: o deploy do webhook-leads nao estava atualizado com o codigo de sequencia, ou houve um erro silencioso na query.

Para prevenir isso no futuro, a correcao garante que o `process-whatsapp-queue` tambem verifique e agende mensagens de sequencia quando enviar uma saudacao sem sequencia, alem de melhorar o log de diagnostico.

---

### Solucao Tecnica

**Arquivo: `supabase/functions/process-whatsapp-queue/index.ts`**

**Correcao 1: Follow-ups sequenciais (linhas 477-500)**

Alterar o calculo de `followUpInserts` para que cada follow-up seja baseado no horario ajustado do anterior:

```
// ANTES (bugado):
const followUpInserts = followUpSteps.map((step) => {
  const rawScheduledMs = now + step.delay_minutes * 60 * 1000
  const scheduledMs = getNextValidSendTime(rawScheduledMs, fuSchedule)
  return { scheduled_for: new Date(scheduledMs).toISOString(), ... }
})

// DEPOIS (corrigido):
let lastScheduledMs = now
const followUpInserts = []
for (const step of followUpSteps) {
  // Calcular delay relativo ao follow-up anterior (nao a "now")
  const rawScheduledMs = lastScheduledMs + step.delay_minutes * 60 * 1000
  const scheduledMs = getNextValidSendTime(rawScheduledMs, fuSchedule)
  lastScheduledMs = scheduledMs  // proximo calcula a partir deste
  followUpInserts.push({ scheduled_for: new Date(scheduledMs).toISOString(), ... })
}
```

Resultado esperado com config 08h-18h Seg-Sex:
- Saudacao enviada segunda 08:00
- FU1 (24h): segunda 08:00 + 24h = terca 08:00 (dentro da janela, OK)
- FU2 (48h): terca 08:00 + 48h = quinta 08:00 (dentro da janela, OK)
- FU3 (72h): quinta 08:00 + 72h = domingo 08:00 -> reagendado para segunda 08:00

Mas e se o lead chega numa quinta-feira as 17h? Sem a correcao, FU1 (24h = sexta 17h, OK), FU2 (48h = sabado 17h -> segunda 08h), FU3 (72h = domingo 17h -> segunda 08h). Com a correcao: FU1 = sexta 17h (OK), FU2 = sexta 17h + 48h = domingo 17h -> segunda 08h, FU3 = segunda 08h + 72h = quinta 08h (correto!).

**IMPORTANTE**: Os delays dos follow-ups sao **absolutos** na tabela (1440, 2880, 4320 minutos desde o lead), mas para o calculo sequencial precisamos do **intervalo entre cada etapa**. A correcao calculara o delta: step[0].delay = 1440min, step[1].delay - step[0].delay = 1440min, etc. Caso os delays sejam incrementais, usaremos diretamente o delta entre etapas consecutivas.

Revisando os dados:
- FU1: delay_minutes=1440 (24h)
- FU2: delay_minutes=2880 (48h) 
- FU3: delay_minutes=4320 (72h)

Esses sao delays acumulados desde o envio da saudacao. Para calculo sequencial, o delta entre cada etapa e:
- FU1: 1440min (24h) desde a saudacao
- FU2: 2880-1440 = 1440min (24h) desde FU1
- FU3: 4320-2880 = 1440min (24h) desde FU2

A logica sera:
```
let lastScheduledMs = now
let previousDelayMinutes = 0
for (const step of sortedFollowUpSteps) {
  const deltaMinutes = step.delay_minutes - previousDelayMinutes
  const rawScheduledMs = lastScheduledMs + deltaMinutes * 60 * 1000
  const scheduledMs = getNextValidSendTime(rawScheduledMs, fuSchedule)
  lastScheduledMs = scheduledMs
  previousDelayMinutes = step.delay_minutes
  followUpInserts.push(...)
}
```

**Correcao 2: Sequencia de saudacao quando nao detectada no webhook (linhas 447-516)**

Apos enviar com sucesso uma saudacao (msg sem `followup_step_id`), antes de agendar follow-ups, verificar se existem etapas de sequencia (`whatsapp_greeting_sequence_steps`) para a regra. Se existirem e nao houver outras mensagens de sequencia ja na fila para este lead, enfileirar as etapas restantes (posicoes 2+).

Isso funciona como uma "rede de seguranca": se o webhook nao enfileirou a sequencia (por qualquer motivo), o processador da fila garante que as mensagens restantes sejam criadas.

A logica adicionada sera inserida logo apos a deteccao de "existingSequenceMsgs" (que ja existe no codigo):

```
// Apos enviar a saudacao com sucesso:
// 1. Verificar se existem sequence steps para a automation_rule_id
// 2. Se sim, verificar se as mensagens de sequencia ja estao na fila
// 3. Se nao, criar as mensagens faltantes (posicoes 2+) com delays corretos
// 4. Aplicar getNextValidSendTime em cada uma
```

---

### Arquivos que serao alterados

1. **`supabase/functions/process-whatsapp-queue/index.ts`** — Ambas as correcoes aplicadas na mesma funcao:
   - Calculo sequencial de follow-ups (correcao 1)
   - Rede de seguranca para sequencia de saudacao (correcao 2)

2. **Deploy** da edge function apos as alteracoes

---

### Resumo do Impacto

| Cenario | Antes (bugado) | Depois (corrigido) |
|---------|----------------|---------------------|
| Lead sexta 19h, FU 24h+48h | Ambos segunda 08h (juntos) | FU1 segunda 08h, FU2 terca 08h |
| Lead quinta 17h, FU 24h+48h+72h | FU2+FU3 segunda 08h (juntos) | FU1 sexta 17h, FU2 segunda 08h, FU3 terca 08h |
| Saudacao com sequencia nao criada pelo webhook | Apenas 1 msg enviada | Sequencia completa enfileirada pelo processador |

