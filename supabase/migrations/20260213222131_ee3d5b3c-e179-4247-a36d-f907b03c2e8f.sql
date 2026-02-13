
-- Update create_default_roles to include conversations.view for Owner and Manager
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
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Proprietário', 'Acesso total ao sistema', true)
  RETURNING id INTO owner_role_id;
  
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Gerente', 'Gerencia leads e equipe', true)
  RETURNING id INTO manager_role_id;
  
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Corretor', 'Gerencia próprios leads', true)
  RETURNING id INTO broker_role_id;
  
  INSERT INTO public.roles (account_id, name, description, is_system)
  VALUES (p_account_id, 'Assistente', 'Acesso limitado de visualização', true)
  RETURNING id INTO assistant_role_id;
  
  -- Atribuir TODAS permissões ao Proprietário
  FOR perm IN SELECT id FROM public.permissions LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (owner_role_id, perm.id, true);
  END LOOP;
  
  -- Atribuir permissões ao Gerente (including conversations.view)
  FOR perm IN SELECT id FROM public.permissions WHERE key IN (
    'leads.view_all', 'leads.create', 'leads.edit', 'leads.delete', 'leads.assign',
    'reports.view', 'team.view', 'team.manage', 'settings.view',
    'calendar.view', 'calendar.manage', 'conversations.view'
  ) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (manager_role_id, perm.id, true);
  END LOOP;
  
  -- Atribuir permissões ao Corretor (NO conversations.view)
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
  
  -- Criar regra de distribuição padrão (Round Robin)
  INSERT INTO public.distribution_rules (account_id, name, rule_type, conditions, priority, is_active, is_default)
  VALUES (p_account_id, 'Distribuição Padrão (Round Robin)', 'round_robin', '{}'::jsonb, 0, true, true);
END;
$function$;
