
-- Create whatsapp_sending_schedule table for business hours configuration
CREATE TABLE IF NOT EXISTS public.whatsapp_sending_schedule (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id   uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  is_enabled   boolean NOT NULL DEFAULT false,
  start_hour   integer NOT NULL DEFAULT 8,
  end_hour     integer NOT NULL DEFAULT 18,
  allowed_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_sending_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sending schedule"
  ON public.whatsapp_sending_schedule
  FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert their own sending schedule"
  ON public.whatsapp_sending_schedule
  FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update their own sending schedule"
  ON public.whatsapp_sending_schedule
  FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Service role can manage all sending schedules"
  ON public.whatsapp_sending_schedule
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER update_whatsapp_sending_schedule_updated_at
  BEFORE UPDATE ON public.whatsapp_sending_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
