-- Table to store form configurations with scoring thresholds
CREATE TABLE public.meta_form_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  form_id TEXT NOT NULL,
  form_name TEXT,
  hot_threshold INTEGER NOT NULL DEFAULT 3,
  warm_threshold INTEGER NOT NULL DEFAULT 1,
  reference_field_name TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, form_id)
);

-- Table to store scoring rules for each question/answer
CREATE TABLE public.meta_form_scoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_config_id UUID NOT NULL REFERENCES public.meta_form_configs(id) ON DELETE CASCADE,
  question_name TEXT NOT NULL,
  question_label TEXT,
  answer_value TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(form_config_id, question_name, answer_value)
);

-- Enable RLS
ALTER TABLE public.meta_form_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_form_scoring_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_form_configs
CREATE POLICY "Users can view form configs from their account"
ON public.meta_form_configs FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create form configs for their account"
ON public.meta_form_configs FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update form configs from their account"
ON public.meta_form_configs FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete form configs from their account"
ON public.meta_form_configs FOR DELETE
USING (account_id = get_user_account_id());

CREATE POLICY "Service role can manage form configs"
ON public.meta_form_configs FOR ALL
USING (auth.role() = 'service_role');

-- RLS policies for meta_form_scoring_rules
CREATE POLICY "Users can view scoring rules from their account"
ON public.meta_form_scoring_rules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.meta_form_configs fc
  WHERE fc.id = meta_form_scoring_rules.form_config_id
  AND fc.account_id = get_user_account_id()
));

CREATE POLICY "Users can create scoring rules for their account"
ON public.meta_form_scoring_rules FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meta_form_configs fc
  WHERE fc.id = meta_form_scoring_rules.form_config_id
  AND fc.account_id = get_user_account_id()
));

CREATE POLICY "Users can update scoring rules from their account"
ON public.meta_form_scoring_rules FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.meta_form_configs fc
  WHERE fc.id = meta_form_scoring_rules.form_config_id
  AND fc.account_id = get_user_account_id()
));

CREATE POLICY "Users can delete scoring rules from their account"
ON public.meta_form_scoring_rules FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.meta_form_configs fc
  WHERE fc.id = meta_form_scoring_rules.form_config_id
  AND fc.account_id = get_user_account_id()
));

CREATE POLICY "Service role can manage scoring rules"
ON public.meta_form_scoring_rules FOR ALL
USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_meta_form_configs_updated_at
BEFORE UPDATE ON public.meta_form_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_form_scoring_rules_updated_at
BEFORE UPDATE ON public.meta_form_scoring_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();