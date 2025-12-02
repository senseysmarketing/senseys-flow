-- Grant leads.assign permission to Owner and Manager roles for all existing accounts
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Proprietário', 'Gerente')
  AND p.key = 'leads.assign'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Update create_default_roles function to include leads.assign for Owner and Manager
CREATE OR REPLACE FUNCTION public.create_default_roles(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner_role_id UUID;
  manager_role_id UUID;
  broker_role_id UUID;
  assistant_role_id UUID;
  perm RECORD;
BEGIN
  -- Criar role Proprietário
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Proprietário', 'Acesso total ao sistema', true)
  RETURNING id INTO owner_role_id;
  
  -- Criar role Gerente
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Gerente', 'Gerencia leads e equipe', true)
  RETURNING id INTO manager_role_id;
  
  -- Criar role Corretor
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Corretor', 'Gerencia próprios leads', true)
  RETURNING id INTO broker_role_id;
  
  -- Criar role Assistente
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Assistente', 'Acesso limitado de visualização', true)
  RETURNING id INTO assistant_role_id;
  
  -- Atribuir TODAS permissões ao Proprietário
  FOR perm IN SELECT id FROM public.permissions LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (owner_role_id, perm.id, true);
  END LOOP;
  
  -- Atribuir permissões ao Gerente (including leads.assign)
  FOR perm IN SELECT id FROM public.permissions WHERE key IN (
    'leads.view_all', 'leads.create', 'leads.edit', 'leads.delete', 'leads.assign',
    'reports.view', 'team.view', 'team.manage', 'settings.view',
    'calendar.view', 'calendar.manage'
  ) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (manager_role_id, perm.id, true);
  END LOOP;
  
  -- Atribuir permissões ao Corretor (NO leads.assign)
  FOR perm IN SELECT id FROM public.permissions WHERE key IN (
    'leads.view_own', 'leads.create', 'leads.edit',
    'calendar.view', 'calendar.manage'
  ) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (broker_role_id, perm.id, true);
  END LOOP;
  
  -- Atribuir permissões ao Assistente
  FOR perm IN SELECT id FROM public.permissions WHERE key IN (
    'leads.view_own', 'calendar.view'
  ) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (assistant_role_id, perm.id, true);
  END LOOP;
END;
$function$;