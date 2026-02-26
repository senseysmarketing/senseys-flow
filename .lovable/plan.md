

## Refatoracao WhatsApp: Maquina de Estados + 4 Ajustes Criticos

### Resumo

Implementar o modelo de maquina de estados aprovado anteriormente, agora com os 4 ajustes propostos pelo ChatGPT incorporados.

---

### Ajuste 1: Deteccao de resposta com janela temporal

**Problema**: A query `WHERE is_from_me = false AND lead_id = X` detecta respostas antigas de meses atras, impedindo novas automacoes.

**Solucao**: Adicionar campo `started_at` na tabela `whatsapp_automation_control` e filtrar respostas apenas apos o inicio da automacao:

```sql
SELECT EXISTS(
  SELECT 1 FROM whatsapp_messages 
  WHERE lead_id = X 
    AND is_from_me = false
    AND created_at > control.started_at
)
```

O campo `started_at` sera preenchido com `now()` no momento da criacao do registro e sera imutavel.

---

### Ajuste 2: Idempotencia do worker (lock otimista)

**Problema**: Se o cron dispara duas execucoes simultaneas, ambas podem pegar o mesmo registro e enviar a mesma mensagem duas vezes.

**Solucao**: Usar UPDATE ... RETURNING como lock otimista. O worker fara:

```sql
UPDATE whatsapp_automation_control
SET status = 'processing',
    updated_at = now()
WHERE id = X
  AND status = 'active'
  AND next_execution_at <= now()
RETURNING *
```

Se nao retornar linha, outro processo ja pegou. Apos envio bem-sucedido, atualiza de volta para `active` com a proxima etapa, ou `finished`/`responded`.

Se falhar no meio, o status fica como `processing` e o worker pode recuperar registros "stuck" (processing ha mais de 5 minutos) no proximo ciclo.

---

### Ajuste 3: Bloqueio de remote_jid apos primeiro envio

**Problema**: Associacao por telefone pode gerar vinculacao errada. Apos o primeiro envio, o `remote_jid` retornado pela Evolution e o identificador definitivo.

**Solucao**: Adicionar campo `jid_locked BOOLEAN DEFAULT false`. Apos o primeiro envio:
- Salvar `remote_jid` retornado pela Evolution
- Setar `jid_locked = true`
- No webhook, so marcar `status = 'responded'` se `remote_jid` bater exatamente (quando `jid_locked = true`)
- Ignora match por telefone quando o JID ja esta travado

---

### Ajuste 4: Snapshot da sequencia no registro de controle

**Problema**: Se o usuario editar a regra de automacao (trocar templates, mudar delays) enquanto um lead esta no meio da sequencia, o lead recebe mensagens inconsistentes.

**Solucao**: Ao criar o registro de controle, salvar um snapshot imutavel de toda a sequencia:

```jsonb
{
  "greeting": [
    { "delay_seconds": 0, "template_id": "abc", "template_content": "Ola {nome}..." },
    { "delay_seconds": 5, "template_id": "def", "template_content": "Temos opcoes..." }
  ],
  "followup": [
    { "delay_minutes": 1440, "template_id": "ghi", "template_content": "Oi {nome}, tudo bem?" },
    { "delay_minutes": 2880, "template_id": "jkl", "template_content": "Ultima tentativa..." }
  ]
}
```

O worker le exclusivamente do snapshot, nunca das tabelas de regras/steps. Isso garante consistencia total durante a vida da automacao.

---

### Schema Final da Tabela

```sql
CREATE TABLE whatsapp_automation_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  automation_rule_id UUID,
  
  -- Maquina de estados
  current_phase TEXT NOT NULL DEFAULT 'greeting',
  current_step_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'processing' | 'responded' | 'finished' | 'failed'
  
  next_execution_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Ajuste 1
  
  -- Identificacao deterministica
  phone TEXT NOT NULL,
  remote_jid TEXT,
  jid_locked BOOLEAN DEFAULT false,               -- Ajuste 3
  
  -- Snapshot imutavel da sequencia
  steps_snapshot JSONB NOT NULL DEFAULT '{}',      -- Ajuste 4
  
  last_sent_message_id TEXT,
  total_messages_sent INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indice para o worker (Ajuste 2: lock otimista)
CREATE INDEX idx_automation_control_worker 
  ON whatsapp_automation_control(status, next_execution_at) 
  WHERE status IN ('active', 'processing');

-- Prevenir duplicatas
CREATE UNIQUE INDEX idx_automation_control_lead_rule 
  ON whatsapp_automation_control(lead_id, automation_rule_id)
  WHERE status IN ('active', 'processing');

-- RLS
ALTER TABLE whatsapp_automation_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON whatsapp_automation_control
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users view own account" ON whatsapp_automation_control
  FOR SELECT USING (account_id = get_user_account_id());
```

---

### Arquivos a Criar/Editar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migration SQL | Criar | Tabela `whatsapp_automation_control` com todos os 4 ajustes |
| `supabase/functions/process-whatsapp-queue/index.ts` | Reescrever | Worker com lock otimista, leitura do snapshot, deteccao temporal de resposta |
| `supabase/functions/whatsapp-webhook/index.ts` | Editar | Marcar `status='responded'` com match por `remote_jid` quando `jid_locked=true` |
| `supabase/functions/webhook-leads/index.ts` | Editar | Criar registro de controle com snapshot ao inves de inserir na fila |
| `supabase/functions/olx-webhook/index.ts` | Editar | Mesmo ajuste do webhook-leads |
| `src/pages/Leads.tsx` | Editar | Ajustar agendamento manual para usar nova tabela |
| `src/hooks/use-scheduled-messages.tsx` | Editar | Ler de `whatsapp_automation_control` |

### Logica do Worker Refatorado (pseudocodigo)

```text
1. SELECT registros WHERE status = 'active' AND next_execution_at <= now() LIMIT 30

2. Para cada registro:
   a. UPDATE SET status='processing' WHERE status='active' RETURNING * (lock otimista)
   b. Se nao retornou -> skip (outro processo pegou)
   
   c. Verificar resposta temporal:
      SELECT EXISTS FROM whatsapp_messages 
      WHERE lead_id = X AND is_from_me = false AND created_at > started_at
      Se sim -> UPDATE status='responded', FIM
   
   d. Verificar horario comercial
      Se fora -> UPDATE status='active', next_execution_at = proximo horario valido, SKIP
   
   e. Verificar sessao WhatsApp (com auto-repair existente)
   
   f. Ler etapa atual do steps_snapshot:
      step = snapshot[current_phase][current_step_position]
      Se nao existe -> avancar fase ou finalizar
   
   g. Substituir variaveis no template (reusar logica existente)
   
   h. Enviar via whatsapp-send
   
   i. Salvar remote_jid + jid_locked=true (no primeiro envio)
   
   j. Atualizar registro:
      current_step_position++
      next_execution_at = agora + delay da proxima etapa (do snapshot)
      total_messages_sent++
      status = 'active' (voltar do processing)
      
   k. Se acabaram as etapas de greeting -> phase='waiting_response',
      next_execution_at = agora + delay do primeiro followup
   
   l. Se phase='waiting_response' e nao respondeu -> phase='followup', step=0
   
   m. Se acabaram followups -> status='finished'

3. Recuperar registros "stuck":
   UPDATE WHERE status='processing' AND updated_at < now() - 5min
   SET status='active'
```

### Transicao e Compatibilidade

- Manter tabela `whatsapp_message_queue` existente (nao deletar)
- Mensagens ja na fila continuam sendo processadas pela logica atual
- Worker novo processa `whatsapp_automation_control` em bloco separado
- Novos leads usam exclusivamente a nova tabela
- Apos 1-2 semanas sem pendencias antigas, remover logica legada

### O que e preservado intacto

- `getNextValidSendTime()` (horario comercial)
- `formatPhoneForEvolution()` (normalizacao de telefone)
- Substituicao de variaveis ({nome}, {imovel}, {corretor}, {empresa}, {form_*})
- Resolucao @lid (findContacts, DB mapping, pushName)
- Rate limiting 1.5s entre envios
- Auto-repair de status de sessao
- Retry automatico no whatsapp-send
- Regras condicionais de saudacao (property, price, campaign, origin, form_answer)

