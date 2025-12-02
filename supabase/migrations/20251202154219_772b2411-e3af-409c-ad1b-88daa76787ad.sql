-- Backfill: Criar roles para contas existentes que ainda não têm
DO $$
DECLARE
  acc RECORD;
  existing_owner_role UUID;
  profile_record RECORD;
BEGIN
  FOR acc IN SELECT id FROM public.accounts LOOP
    -- Verificar se já tem roles
    SELECT id INTO existing_owner_role FROM public.roles 
    WHERE account_id = acc.id AND name = 'Proprietário' LIMIT 1;
    
    IF existing_owner_role IS NULL THEN
      -- Criar roles padrão
      PERFORM public.create_default_roles(acc.id);
      
      -- Buscar o owner role recém criado
      SELECT id INTO existing_owner_role FROM public.roles 
      WHERE account_id = acc.id AND name = 'Proprietário';
      
      -- Atribuir o primeiro usuário da conta como owner
      FOR profile_record IN 
        SELECT user_id FROM public.profiles WHERE account_id = acc.id
        ORDER BY created_at ASC
      LOOP
        -- Verificar se o usuário já tem um role
        IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = profile_record.user_id) THEN
          INSERT INTO public.user_roles (user_id, role_id)
          VALUES (profile_record.user_id, existing_owner_role);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;