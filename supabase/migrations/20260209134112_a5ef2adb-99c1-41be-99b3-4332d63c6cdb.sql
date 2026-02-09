
CREATE TABLE public.lead_disqualification_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_disqualification_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reasons for their account"
  ON public.lead_disqualification_reasons FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can view reasons from their account"
  ON public.lead_disqualification_reasons FOR SELECT
  USING (account_id = get_user_account_id());
