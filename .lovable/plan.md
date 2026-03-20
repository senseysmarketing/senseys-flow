

## IA de Avanço Automático de Leads no Funil (Revisado)

### Mudanças no Banco de Dados (Migration)

**1. Adicionar colunas na tabela `accounts`:**
```sql
ALTER TABLE public.accounts ADD COLUMN ai_funnel_enabled boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN last_ai_funnel_run_at timestamptz;
```

**2. Criar tabela `ai_funnel_logs`:**
```sql
CREATE TABLE public.ai_funnel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  previous_status_id uuid REFERENCES lead_status(id),
  new_status_id uuid REFERENCES lead_status(id),
  ai_summary text NOT NULL,
  action_taken text NOT NULL, -- 'advanced', 'no_change', 'error'
  messages_analyzed integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_funnel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ai_funnel_logs from their account"
  ON ai_funnel_logs FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());
CREATE POLICY "Service role can manage ai_funnel_logs"
  ON ai_funnel_logs FOR ALL
  USING (auth.role() = 'service_role');
```

---

### Nova Edge Function: `ai-funnel-advance`

**Fluxo:**

1. Buscar contas com `ai_funnel_enabled = true`
2. Para cada conta, buscar leads em status intermediários (posição 1-5, excluindo "Novo Lead", "Fechado", "Perdido") que tenham mensagens recebidas (`is_from_me = false`) após `last_ai_funnel_run_at`
3. Buscar lista de `lead_status` da conta com `id`, `name`, `position` para enviar ao prompt
4. Para cada lead, buscar últimas 30 mensagens da conversa

**Ajuste 1 — Tool Calling com `status_id` (UUID):**

O prompt fornece a lista de status no formato `[{"id": "uuid", "name": "Qualificado", "position": 2}]`. A resposta é extraída via tool calling com schema:

```json
{
  "name": "classify_lead_status",
  "parameters": {
    "type": "object",
    "properties": {
      "new_status_id": { "type": "string", "description": "UUID do novo status ou 'null' se sem mudança" },
      "reason": { "type": "string", "description": "Resumo de 1 linha do motivo" }
    },
    "required": ["new_status_id", "reason"]
  }
}
```

Isso elimina problemas de digitação/acentuação — a IA retorna o UUID exato.

**Ajuste 2 — Processamento paralelo em chunks:**

- Timeout por chamada de IA: **15 segundos** (não 5s)
- Leads processados em **chunks de 5** via `Promise.all`, não sequencialmente
- Máximo 50 leads por conta por execução
- Isso garante finalização dentro do limite de 2 minutos das Edge Functions (~10 chunks × 15s = 150s máx)

**Ajuste 3 — Disparo do evento Meta CAPI:**

Quando a IA avança um lead, após o UPDATE do `status_id`, a Edge Function invoca `send-meta-event` internamente (usando `fetch` com header `x-internal-call: true` e `service_role` key), verificando primeiro se existe um mapeamento em `meta_event_mappings` para o novo status. Isso replica exatamente o comportamento do frontend em `Leads.tsx`.

```typescript
// Após UPDATE do lead
const { data: mapping } = await supabase
  .from('meta_event_mappings')
  .select('event_name, lead_type')
  .eq('account_id', accountId)
  .eq('status_id', newStatusId)
  .eq('is_active', true)
  .maybeSingle();

if (mapping) {
  await fetch(`${SUPABASE_URL}/functions/v1/send-meta-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'x-internal-call': 'true'
    },
    body: JSON.stringify({
      lead_id: leadId,
      event_name: mapping.event_name,
      custom_data: { lead_type: mapping.lead_type }
    })
  });
}
```

**Ajuste 4 — Registro na `lead_activities` (não em `observacoes`):**

Em vez de poluir o campo de texto `observacoes`, a IA insere um registro na tabela `lead_activities` (já existente, com timeline no `LeadActivityTimeline.tsx`):

```typescript
await supabase.from('lead_activities').insert({
  lead_id: leadId,
  account_id: accountId,
  activity_type: 'status_changed',
  description: `[IA] ${reason}`,
  old_value: oldStatusName,
  new_value: newStatusName,
  created_by: null // null indica ação do sistema/IA
});
```

Isso aparece automaticamente na timeline do lead sem alterar nenhum dado manual dos corretores.

---

### Cron Job (pg_cron + pg_net)

A cada 1 hora:
```sql
SELECT cron.schedule(
  'ai-funnel-advance-hourly',
  '0 * * * *',
  $$ SELECT net.http_post(
    url:='https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/ai-funnel-advance',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb
  ) $$
);
```

---

### Frontend: Toggle + Logs

**Em `src/pages/Settings.tsx`**: Card "IA de Avanço Automático" com Switch toggle (`ai_funnel_enabled`), badge "Beta", último run formatado.

**Em `LeadsSettingsSheet.tsx`**: Item "Logs da IA" com modal mostrando registros de `ai_funnel_logs`.

---

### Detalhes Técnicos

- Modelo: `google/gemini-3-flash-preview` via Lovable AI Gateway
- Edge function config: `verify_jwt = false` (chamada via cron)
- Secret: `LOVABLE_API_KEY` (já existe)
- Validação: só avança se `new_status_id` existe na conta E tem `position` maior que o atual

### O que NÃO muda
- Fluxo manual de drag-and-drop no Kanban
- Automação existente "Novo Lead" → "Em Contato"
- Envio de mensagens WhatsApp
- Campo `observacoes` dos leads (intocado)

