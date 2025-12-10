-- =============================================
-- META INTEGRATION TABLES AND COLUMNS
-- =============================================

-- 1. Tabela para armazenar token da agência Meta
CREATE TABLE public.meta_agency_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  token_expires_at timestamptz,
  user_id text,
  user_name text,
  scopes text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para meta_agency_token (apenas super admins)
ALTER TABLE public.meta_agency_token ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage meta_agency_token"
ON public.meta_agency_token
FOR ALL
USING (is_super_admin(auth.uid()));

-- 2. Tabela para configuração Meta por cliente
CREATE TABLE public.account_meta_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  ad_account_name text,
  page_id text,
  page_name text,
  form_id text,
  form_name text,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);

-- RLS para account_meta_config
ALTER TABLE public.account_meta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage account_meta_config"
ON public.account_meta_config
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own account_meta_config"
ON public.account_meta_config
FOR SELECT
USING (account_id = get_user_account_id());

-- 3. Tabela para cache de insights de anúncios
CREATE TABLE public.meta_ad_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  leads_count integer DEFAULT 0,
  reach integer DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpl numeric DEFAULT 0,
  campaign_data jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, date)
);

-- RLS para meta_ad_insights
ALTER TABLE public.meta_ad_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage meta_ad_insights"
ON public.meta_ad_insights
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own meta_ad_insights"
ON public.meta_ad_insights
FOR SELECT
USING (account_id = get_user_account_id());

-- 4. Adicionar reference_code na tabela properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS reference_code text;

-- Constraint única por account_id + reference_code
ALTER TABLE public.properties
ADD CONSTRAINT properties_reference_code_account_unique 
UNIQUE(account_id, reference_code);

-- 5. Adicionar campos Meta na tabela leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS meta_lead_id text,
ADD COLUMN IF NOT EXISTS meta_form_id text,
ADD COLUMN IF NOT EXISTS meta_ad_id text,
ADD COLUMN IF NOT EXISTS meta_campaign_id text,
ADD COLUMN IF NOT EXISTS meta_ad_name text,
ADD COLUMN IF NOT EXISTS meta_campaign_name text;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_meta_lead_id ON public.leads(meta_lead_id);
CREATE INDEX IF NOT EXISTS idx_properties_reference_code ON public.properties(reference_code);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_account_date ON public.meta_ad_insights(account_id, date);

-- Trigger para updated_at nas novas tabelas
CREATE TRIGGER update_meta_agency_token_updated_at
BEFORE UPDATE ON public.meta_agency_token
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_meta_config_updated_at
BEFORE UPDATE ON public.account_meta_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();