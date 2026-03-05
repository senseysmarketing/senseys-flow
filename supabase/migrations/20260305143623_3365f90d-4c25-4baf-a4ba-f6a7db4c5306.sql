ALTER TABLE public.whatsapp_automation_control 
ADD COLUMN IF NOT EXISTS last_followup_sent_at timestamp with time zone DEFAULT NULL;