-- Criar tabela de imóveis
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  assigned_broker_id UUID REFERENCES public.profiles(user_id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  area_m2 DECIMAL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking_spots INTEGER,
  sale_price DECIMAL,
  rent_price DECIMAL,
  condo_fee DECIMAL,
  iptu DECIMAL,
  description TEXT,
  status TEXT DEFAULT 'disponivel',
  campaign_name TEXT,
  campaign_cost DECIMAL,
  image_urls JSONB DEFAULT '[]',
  amenities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de regras de distribuição
CREATE TABLE public.distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  target_broker_id UUID REFERENCES public.profiles(user_id),
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela para round robin
CREATE TABLE public.broker_round_robin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID UNIQUE NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  last_broker_index INTEGER DEFAULT 0,
  broker_order JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN assigned_broker_id UUID REFERENCES public.profiles(user_id),
  ADD COLUMN property_id UUID REFERENCES public.properties(id);

-- Habilitar RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_round_robin ENABLE ROW LEVEL SECURITY;

-- RLS para properties
CREATE POLICY "Users can view properties from their account"
ON public.properties FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create properties for their account"
ON public.properties FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update properties from their account"
ON public.properties FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete properties from their account"
ON public.properties FOR DELETE
USING (account_id = get_user_account_id());

-- RLS para distribution_rules (apenas owners/managers)
CREATE POLICY "Users can view distribution_rules from their account"
ON public.distribution_rules FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Owners/managers can manage distribution_rules"
ON public.distribution_rules FOR ALL
USING (
  account_id = get_user_account_id() AND
  (is_account_owner() OR has_permission(auth.uid(), 'settings.manage'))
);

-- RLS para broker_round_robin
CREATE POLICY "Users can view round_robin from their account"
ON public.broker_round_robin FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Owners/managers can manage round_robin"
ON public.broker_round_robin FOR ALL
USING (
  account_id = get_user_account_id() AND
  (is_account_owner() OR has_permission(auth.uid(), 'settings.manage'))
);

-- Trigger para updated_at
CREATE TRIGGER update_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_distribution_rules_updated_at
BEFORE UPDATE ON public.distribution_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_round_robin_updated_at
BEFORE UPDATE ON public.broker_round_robin
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_properties_account_id ON public.properties(account_id);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_distribution_rules_account_id ON public.distribution_rules(account_id);
CREATE INDEX idx_leads_assigned_broker ON public.leads(assigned_broker_id);
CREATE INDEX idx_leads_property ON public.leads(property_id);