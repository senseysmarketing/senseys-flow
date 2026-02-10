
-- Add duplicate detection columns to leads table
ALTER TABLE public.leads 
ADD COLUMN is_duplicate boolean NOT NULL DEFAULT false,
ADD COLUMN duplicate_of_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Index for faster duplicate lookups
CREATE INDEX idx_leads_duplicate_of ON public.leads(duplicate_of_lead_id) WHERE duplicate_of_lead_id IS NOT NULL;
