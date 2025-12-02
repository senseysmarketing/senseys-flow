-- Create custom_fields table
CREATE TABLE public.custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT NULL,
  placeholder TEXT DEFAULT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, field_key)
);

-- Create lead_custom_field_values table
CREATE TABLE public.lead_custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, custom_field_id)
);

-- Enable RLS on custom_fields
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_fields
CREATE POLICY "Users can view custom_fields from their account"
ON public.custom_fields
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create custom_fields for their account"
ON public.custom_fields
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update custom_fields from their account"
ON public.custom_fields
FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete custom_fields from their account"
ON public.custom_fields
FOR DELETE
USING (account_id = get_user_account_id());

-- Enable RLS on lead_custom_field_values
ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_custom_field_values (through lead's account)
CREATE POLICY "Users can view custom_field_values from their account"
ON public.lead_custom_field_values
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.leads l
  WHERE l.id = lead_custom_field_values.lead_id
  AND l.account_id = get_user_account_id()
));

CREATE POLICY "Users can create custom_field_values for their account"
ON public.lead_custom_field_values
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leads l
  WHERE l.id = lead_custom_field_values.lead_id
  AND l.account_id = get_user_account_id()
));

CREATE POLICY "Users can update custom_field_values from their account"
ON public.lead_custom_field_values
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.leads l
  WHERE l.id = lead_custom_field_values.lead_id
  AND l.account_id = get_user_account_id()
));

CREATE POLICY "Users can delete custom_field_values from their account"
ON public.lead_custom_field_values
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.leads l
  WHERE l.id = lead_custom_field_values.lead_id
  AND l.account_id = get_user_account_id()
));

-- Service role policy for webhook
CREATE POLICY "Service role can manage custom_field_values"
ON public.lead_custom_field_values
FOR ALL
USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_custom_fields_account_id ON public.custom_fields(account_id);
CREATE INDEX idx_custom_fields_field_key ON public.custom_fields(account_id, field_key);
CREATE INDEX idx_lead_custom_field_values_lead_id ON public.lead_custom_field_values(lead_id);
CREATE INDEX idx_lead_custom_field_values_custom_field_id ON public.lead_custom_field_values(custom_field_id);

-- Triggers for updated_at
CREATE TRIGGER update_custom_fields_updated_at
BEFORE UPDATE ON public.custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_custom_field_values_updated_at
BEFORE UPDATE ON public.lead_custom_field_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();