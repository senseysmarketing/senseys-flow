
-- Create greeting sequence steps table
CREATE TABLE public.whatsapp_greeting_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  automation_rule_id uuid REFERENCES public.whatsapp_automation_rules(id) ON DELETE CASCADE,
  greeting_rule_id uuid REFERENCES public.whatsapp_greeting_rules(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.whatsapp_templates(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  delay_seconds integer NOT NULL DEFAULT 5,
  name text NOT NULL DEFAULT 'Mensagem',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_greeting_sequence_steps ENABLE ROW LEVEL SECURITY;

-- Policy: users manage their own account steps
CREATE POLICY "Users can manage own sequence steps"
  ON public.whatsapp_greeting_sequence_steps
  FOR ALL
  USING (account_id = get_user_account_id())
  WITH CHECK (account_id = get_user_account_id());

-- Policy: service role can do anything (needed for webhook-leads edge function)
CREATE POLICY "Service role can manage sequence steps"
  ON public.whatsapp_greeting_sequence_steps
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER update_greeting_sequence_steps_updated_at
  BEFORE UPDATE ON public.whatsapp_greeting_sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
