-- Fix security warnings by setting search_path on functions without dropping them

-- Update get_user_account_id function with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT account_id 
        FROM public.profiles 
        WHERE user_id = auth.uid()
    );
END;
$$;

-- Update handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_account_id UUID;
BEGIN
    -- Create new account for the user
    INSERT INTO public.accounts (name) 
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nova Conta'))
    RETURNING id INTO new_account_id;
    
    -- Create profile for the user
    INSERT INTO public.profiles (user_id, account_id, full_name)
    VALUES (NEW.id, new_account_id, NEW.raw_user_meta_data->>'full_name');
    
    -- Create default lead statuses
    INSERT INTO public.lead_status (account_id, name, color, position, is_default) VALUES
    (new_account_id, 'Novo Lead', '#81afd1', 0, true),
    (new_account_id, 'Em Contato', '#a6c8e1', 1, false),
    (new_account_id, 'Qualificado', '#465666', 2, false),
    (new_account_id, 'Proposta', '#5a5f65', 3, false),
    (new_account_id, 'Negociação', '#2b2d2c', 4, false),
    (new_account_id, 'Fechado', '#22c55e', 5, false),
    (new_account_id, 'Desistiu', '#ef4444', 6, false);
    
    RETURN NEW;
END;
$$;

-- Update update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;