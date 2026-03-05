ALTER TABLE public.whatsapp_automation_control
ADD COLUMN IF NOT EXISTS conversation_state text DEFAULT 'new_lead';