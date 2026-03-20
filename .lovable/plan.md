## IA de Avanço Automático de Leads no Funil

### Status: Implementado ✅

### O que foi criado

1. **Migration**: Colunas `ai_funnel_enabled` e `last_ai_funnel_run_at` na tabela `accounts` + tabela `ai_funnel_logs` com RLS
2. **Edge Function `ai-funnel-advance`**: Analisa conversas do WhatsApp via Gemini 3 Flash, avança leads no funil, dispara Meta CAPI, registra na timeline
3. **Frontend**: Toggle em Configurações > Notificações + modal "Logs da IA" no menu de configurações de Leads

### Pendente (ação manual do usuário)

O cron job precisa ser criado no SQL Editor do Supabase:

```sql
SELECT cron.schedule(
  'ai-funnel-advance-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/ai-funnel-advance',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqb2R4bHpsZnZkd3F1ZmtnZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMzE4MTQsImV4cCI6MjA3MzgwNzgxNH0.lACzxZrVOLEf996sq6oLV5M48k174JGWrsXkvbrWsEM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```
