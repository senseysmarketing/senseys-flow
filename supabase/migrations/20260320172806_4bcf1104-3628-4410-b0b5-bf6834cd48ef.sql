
-- Add AI funnel columns to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS ai_funnel_enabled boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_ai_funnel_run_at timestamptz;

-- Create AI funnel logs table
CREATE TABLE IF NOT EXISTS public.ai_funnel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  previous_status_id uuid REFERENCES public.lead_status(id),
  new_status_id uuid REFERENCES public.lead_status(id),
  ai_summary text NOT NULL,
  action_taken text NOT NULL,
  messages_analyzed integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_funnel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_funnel_logs from their account"
  ON public.ai_funnel_logs FOR SELECT TO authenticated
  USING (account_id = get_user_account_id());

CREATE POLICY "Service role can manage ai_funnel_logs"
  ON public.ai_funnel_logs FOR ALL TO service_role
  USING (true);
