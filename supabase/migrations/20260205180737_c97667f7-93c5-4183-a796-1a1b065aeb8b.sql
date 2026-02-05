-- Create mapping table for form_id -> reference_code
CREATE TABLE public.meta_form_property_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  form_name TEXT,
  reference_code TEXT NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, form_id)
);

-- Indexes for performance
CREATE INDEX idx_form_property_mapping_account ON public.meta_form_property_mapping(account_id);
CREATE INDEX idx_form_property_mapping_ref ON public.meta_form_property_mapping(reference_code);
CREATE INDEX idx_form_property_mapping_property ON public.meta_form_property_mapping(property_id);

-- Enable RLS
ALTER TABLE public.meta_form_property_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own account mappings"
  ON public.meta_form_property_mapping FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Service role can manage mappings"
  ON public.meta_form_property_mapping FOR ALL
  USING (auth.role() = 'service_role');

-- Populate with existing data from leads
INSERT INTO public.meta_form_property_mapping (account_id, form_id, reference_code, property_id)
SELECT DISTINCT ON (l.account_id, l.meta_form_id)
  l.account_id,
  l.meta_form_id,
  p.reference_code,
  l.property_id
FROM public.leads l
JOIN public.properties p ON l.property_id = p.id
WHERE l.meta_form_id IS NOT NULL
  AND p.reference_code IS NOT NULL
ORDER BY l.account_id, l.meta_form_id, l.created_at DESC
ON CONFLICT DO NOTHING;