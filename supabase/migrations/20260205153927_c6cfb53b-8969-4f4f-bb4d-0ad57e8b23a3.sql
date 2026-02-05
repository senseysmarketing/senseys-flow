-- Create table for ad-level insights with form_id linking
CREATE TABLE public.meta_ad_insights_by_ad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  form_id TEXT,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, date, ad_id)
);

-- Indices for fast lookups
CREATE INDEX idx_ad_insights_by_ad_account_date ON public.meta_ad_insights_by_ad(account_id, date);
CREATE INDEX idx_ad_insights_by_ad_form_id ON public.meta_ad_insights_by_ad(form_id);
CREATE INDEX idx_ad_insights_by_ad_ad_id ON public.meta_ad_insights_by_ad(ad_id);

-- Enable RLS
ALTER TABLE public.meta_ad_insights_by_ad ENABLE ROW LEVEL SECURITY;

-- Super admins can manage (for sync via edge function)
CREATE POLICY "Super admins can manage meta_ad_insights_by_ad"
ON public.meta_ad_insights_by_ad
FOR ALL
USING (is_super_admin(auth.uid()));

-- Users can view their own account's data
CREATE POLICY "Users can view their own meta_ad_insights_by_ad"
ON public.meta_ad_insights_by_ad
FOR SELECT
USING (account_id = get_user_account_id());

-- Service role can insert/update for edge functions
CREATE POLICY "Service role can manage meta_ad_insights_by_ad"
ON public.meta_ad_insights_by_ad
FOR ALL
USING (auth.role() = 'service_role');