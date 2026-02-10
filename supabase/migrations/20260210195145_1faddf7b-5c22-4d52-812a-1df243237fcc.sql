
-- Create follow-up steps table
CREATE TABLE public.whatsapp_followup_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.whatsapp_templates(id) ON DELETE CASCADE,
  delay_minutes INTEGER NOT NULL DEFAULT 60,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_followup_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view follow-up steps of their account"
ON public.whatsapp_followup_steps FOR SELECT
USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert follow-up steps for their account"
ON public.whatsapp_followup_steps FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update follow-up steps of their account"
ON public.whatsapp_followup_steps FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete follow-up steps of their account"
ON public.whatsapp_followup_steps FOR DELETE
USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

-- Add followup_step_id column to whatsapp_message_queue
ALTER TABLE public.whatsapp_message_queue 
ADD COLUMN followup_step_id UUID REFERENCES public.whatsapp_followup_steps(id) ON DELETE SET NULL;
