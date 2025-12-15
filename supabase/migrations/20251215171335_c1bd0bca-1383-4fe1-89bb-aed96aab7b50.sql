-- Modify is_super_admin function to include all users from the agency account
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
  OR EXISTS (
    -- All users from the "Senseys - Gabriel Facioli" agency account have super admin access
    SELECT 1 FROM public.profiles 
    WHERE user_id = _user_id 
    AND account_id = '05f41011-8143-4a71-a3ca-8f42f043ab8c'
  )
$$;