-- Create table to store form field values from webhooks
CREATE TABLE public.lead_form_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT,
  field_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_lead_form_field_values_lead_id ON public.lead_form_field_values(lead_id);

-- Enable RLS
ALTER TABLE public.lead_form_field_values ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role can manage form field values"
ON public.lead_form_field_values FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view form field values from their account"
ON public.lead_form_field_values FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.leads l
  WHERE l.id = lead_form_field_values.lead_id
  AND l.account_id = get_user_account_id()
));