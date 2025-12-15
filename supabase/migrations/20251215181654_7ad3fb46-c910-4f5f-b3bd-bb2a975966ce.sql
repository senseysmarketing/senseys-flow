-- Add source_type column to meta_form_configs to distinguish between Meta and Webhook forms
ALTER TABLE public.meta_form_configs 
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'meta';

-- Add comment for documentation
COMMENT ON COLUMN public.meta_form_configs.source_type IS 'Source of the form: meta (Facebook Lead Ads) or webhook (external webhook)';