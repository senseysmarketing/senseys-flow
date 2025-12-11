-- Aplicar padronização para todas as contas existentes
DO $$
DECLARE
  acc RECORD;
BEGIN
  FOR acc IN SELECT id FROM public.accounts
  LOOP
    PERFORM public.apply_standard_lead_statuses(acc.id);
    PERFORM public.create_default_meta_mappings(acc.id);
  END LOOP;
END $$;

-- Atualizar função handle_new_user para usar os novos status padrão
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