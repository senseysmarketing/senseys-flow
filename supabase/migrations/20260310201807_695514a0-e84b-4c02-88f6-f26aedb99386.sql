ALTER TABLE public.whatsapp_automation_control 
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;