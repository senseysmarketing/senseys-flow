-- Update handle_new_user trigger to check if user is being created as a team member
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    new_account_id UUID;
    owner_role_id UUID;
    is_team_member BOOLEAN;
    target_account UUID;
BEGIN
    -- Check if this is a team member being created via edge function
    is_team_member := COALESCE((NEW.raw_user_meta_data->>'is_team_member')::boolean, false);
    
    IF is_team_member THEN
        -- Team member: only create profile with target account_id
        -- The edge function will handle role assignment
        target_account := (NEW.raw_user_meta_data->>'target_account_id')::uuid;
        
        INSERT INTO public.profiles (user_id, account_id, full_name)
        VALUES (
            NEW.id, 
            target_account,
            NEW.raw_user_meta_data->>'full_name'
        );
        
        -- Do NOT create account, roles, statuses, or mappings for team members
        RETURN NEW;
    END IF;
    
    -- Normal flow: create new account for new owner (via Agency Admin or signup)
    INSERT INTO public.accounts (name) 
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nova Conta'))
    RETURNING id INTO new_account_id;
    
    INSERT INTO public.profiles (user_id, account_id, full_name)
    VALUES (NEW.id, new_account_id, NEW.raw_user_meta_data->>'full_name');
    
    PERFORM public.apply_standard_lead_statuses(new_account_id);
    PERFORM public.create_default_meta_mappings(new_account_id);
    PERFORM public.create_default_roles(new_account_id);
    
    SELECT id INTO owner_role_id FROM public.roles 
    WHERE account_id = new_account_id AND name = 'Proprietário';
    
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, owner_role_id);
    
    RETURN NEW;
END;
$function$;