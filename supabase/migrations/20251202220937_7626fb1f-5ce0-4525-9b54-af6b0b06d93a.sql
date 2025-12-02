-- Create super_admins table for agency-level access
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Only super admins can view this table
CREATE POLICY "Super admins can view super_admins"
ON public.super_admins
FOR SELECT
USING (user_id = auth.uid());

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
  )
$$;

-- Insert the first super admin
INSERT INTO public.super_admins (user_id, email)
VALUES ('9be6929f-638e-4c77-8acd-92ca252b78f6', 'gabrielcremonezifacioli@gmail.com');