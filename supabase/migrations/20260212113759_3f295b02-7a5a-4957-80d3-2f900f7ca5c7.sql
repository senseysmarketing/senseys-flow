SELECT cron.schedule(
  'process-whatsapp-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/process-whatsapp-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqb2R4bHpsZnZkd3F1ZmtnZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMzE4MTQsImV4cCI6MjA3MzgwNzgxNH0.lACzxZrVOLEf996sq6oLV5M48k174JGWrsXkvbrWsEM"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);