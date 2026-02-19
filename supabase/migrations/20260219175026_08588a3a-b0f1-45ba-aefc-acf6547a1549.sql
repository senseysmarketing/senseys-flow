ALTER TABLE public.whatsapp_greeting_rules
  ADD COLUMN IF NOT EXISTS condition_form_question TEXT,
  ADD COLUMN IF NOT EXISTS condition_form_answer TEXT;