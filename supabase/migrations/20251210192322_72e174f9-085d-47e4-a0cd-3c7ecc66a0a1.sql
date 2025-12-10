-- Add is_system column to lead_status table
ALTER TABLE public.lead_status ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Update RLS policy to prevent deletion of system statuses
DROP POLICY IF EXISTS "Users can manage status from their account" ON public.lead_status;

CREATE POLICY "Users can view status from their account" 
ON public.lead_status 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert status to their account" 
ON public.lead_status 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update status from their account" 
ON public.lead_status 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete non-system status from their account" 
ON public.lead_status 
FOR DELETE 
USING (account_id = get_user_account_id() AND is_system = false);

-- Update handle_new_user function with new default statuses
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    new_account_id UUID;
    owner_role_id UUID;
BEGIN
    -- Create new account for the user
    INSERT INTO public.accounts (name) 
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nova Conta'))
    RETURNING id INTO new_account_id;
    
    -- Create profile for the user
    INSERT INTO public.profiles (user_id, account_id, full_name)
    VALUES (NEW.id, new_account_id, NEW.raw_user_meta_data->>'full_name');
    
    -- Create default lead statuses (system statuses that cannot be deleted)
    INSERT INTO public.lead_status (account_id, name, color, position, is_default, is_system) VALUES
    (new_account_id, 'Novo Lead', '#81afd1', 0, true, true),
    (new_account_id, 'Em Contato', '#a6c8e1', 1, false, true),
    (new_account_id, 'Visita', '#465666', 2, false, true),
    (new_account_id, 'Fechado', '#22c55e', 3, false, true),
    (new_account_id, 'Desqualificado', '#ef4444', 4, false, true),
    (new_account_id, 'Sem Contato', '#5a5f65', 5, false, true);
    
    -- Create default roles for the account
    PERFORM public.create_default_roles(new_account_id);
    
    -- Get the owner role and assign to the new user
    SELECT id INTO owner_role_id FROM public.roles 
    WHERE account_id = new_account_id AND name = 'Proprietário';
    
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, owner_role_id);
    
    RETURN NEW;
END;
$function$;