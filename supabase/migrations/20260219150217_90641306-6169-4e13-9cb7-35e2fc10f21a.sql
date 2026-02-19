-- Create whatsapp_greeting_rules table for conditional greeting rules
CREATE TABLE public.whatsapp_greeting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  delay_seconds INTEGER DEFAULT 60,
  condition_type TEXT NOT NULL,
  condition_property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  condition_price_min NUMERIC,
  condition_price_max NUMERIC,
  condition_property_type TEXT,
  condition_transaction_type TEXT,
  condition_campaign TEXT,
  condition_origin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.whatsapp_greeting_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage greeting rules for their account"
  ON public.whatsapp_greeting_rules
  FOR ALL
  USING (account_id = get_user_account_id());

CREATE POLICY "Service role can manage all greeting rules"
  ON public.whatsapp_greeting_rules
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE TRIGGER update_whatsapp_greeting_rules_updated_at
  BEFORE UPDATE ON public.whatsapp_greeting_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add OLX to trigger_sources default for new records
ALTER TABLE public.whatsapp_automation_rules
  ALTER COLUMN trigger_sources SET DEFAULT '{"manual": true, "meta": true, "webhook": true, "olx": true}'::jsonb;

-- Update existing records to include olx: true
UPDATE public.whatsapp_automation_rules
  SET trigger_sources = trigger_sources || '{"olx": true}'::jsonb
  WHERE trigger_sources IS NOT NULL AND NOT (trigger_sources ? 'olx');

UPDATE public.whatsapp_automation_rules
  SET trigger_sources = '{"manual": true, "meta": true, "webhook": true, "olx": true}'::jsonb
  WHERE trigger_sources IS NULL;