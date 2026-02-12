
## Configurar Processamento Automatico da Fila de WhatsApp

### Status Atual

- A funcao `process-whatsapp-queue` foi invocada manualmente com sucesso
- **2 mensagens enviadas** (incluindo a saudacao da Daniela)
- **3 follow-ups agendados** automaticamente para a lead Daniela
- Fila agora esta vazia (todas as pendentes foram processadas)

### O que sera feito

**1. Habilitar extensoes pg_cron e pg_net (via migration)**

Essas extensoes sao necessarias para agendar chamadas HTTP periodicas dentro do Supabase.

**2. Criar cron job para processar a fila a cada minuto (via SQL insert)**

O cron job vai chamar a edge function `process-whatsapp-queue` a cada minuto. A funcao ja possui logica para:
- Buscar apenas mensagens com `scheduled_for <= now()`
- Respeitar os delays configurados em cada saudacao e follow-up
- Pular se nao houver mensagens pendentes (execucao leve)

### Como funciona o fluxo completo

```text
Lead criada
  |
  v
Saudacao agendada na fila (com delay configurado)
  |
  v
pg_cron (a cada 1 min) -> process-whatsapp-queue
  |
  v
Mensagem enviada via Evolution API
  |
  v
Follow-ups agendados automaticamente (com delays individuais)
  |
  v
pg_cron processa follow-ups quando scheduled_for <= now()
```

### Detalhes Tecnicos

**Migration (schema change):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

**Cron job (data insert via SQL insert tool):**
```sql
SELECT cron.schedule(
  'process-whatsapp-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/process-whatsapp-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body := '{"time": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

Isso garante que todas as mensagens (saudacoes e follow-ups) sejam processadas no momento correto, respeitando os delays configurados por cada conta.
