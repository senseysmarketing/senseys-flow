-- Add pixel_id to account_meta_config
ALTER TABLE public.account_meta_config ADD COLUMN IF NOT EXISTS pixel_id TEXT;

-- Create meta_event_mappings table for status-to-event mapping
CREATE TABLE public.meta_event_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  status_id UUID NOT NULL REFERENCES public.lead_status(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  lead_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, status_id)
);

-- Create meta_capi_events_log table for audit trail
CREATE TABLE public.meta_capi_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  account_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  pixel_id TEXT,
  status_code INTEGER,
  response_body JSONB,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_capi_events_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_event_mappings
CREATE POLICY "Users can view mappings from their account" 
ON public.meta_event_mappings FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create mappings for their account" 
ON public.meta_event_mappings FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update mappings from their account" 
ON public.meta_event_mappings FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete mappings from their account" 
ON public.meta_event_mappings FOR DELETE 
USING (account_id = get_user_account_id());

-- RLS policies for meta_capi_events_log
CREATE POLICY "Users can view logs from their account" 
ON public.meta_capi_events_log FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Service role can insert logs" 
ON public.meta_capi_events_log FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_meta_event_mappings_account ON public.meta_event_mappings(account_id);
CREATE INDEX idx_meta_event_mappings_status ON public.meta_event_mappings(status_id);
CREATE INDEX idx_meta_capi_events_log_lead ON public.meta_capi_events_log(lead_id);
CREATE INDEX idx_meta_capi_events_log_account ON public.meta_capi_events_log(account_id);
CREATE INDEX idx_meta_capi_events_log_sent_at ON public.meta_capi_events_log(sent_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_meta_event_mappings_updated_at
BEFORE UPDATE ON public.meta_event_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();