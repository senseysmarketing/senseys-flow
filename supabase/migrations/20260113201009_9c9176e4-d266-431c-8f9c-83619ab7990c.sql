-- Add is_default column to distribution_rules
ALTER TABLE public.distribution_rules ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create default distribution rules for accounts that don't have any rules
INSERT INTO public.distribution_rules (account_id, name, rule_type, conditions, priority, is_active, is_default)
SELECT 
  a.id,
  'Distribuição Padrão (Round Robin)',
  'round_robin',
  '{}'::jsonb,
  0,
  true,
  true
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.distribution_rules dr 
  WHERE dr.account_id = a.id
);

-- Update existing round_robin rules with lowest priority to be default if account has no default
UPDATE public.distribution_rules dr1
SET is_default = true
WHERE dr1.rule_type = 'round_robin'
  AND dr1.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.distribution_rules dr2 
    WHERE dr2.account_id = dr1.account_id AND dr2.is_default = true
  )
  AND dr1.priority = (
    SELECT MIN(dr3.priority) 
    FROM public.distribution_rules dr3 
    WHERE dr3.account_id = dr1.account_id AND dr3.is_active = true
  );

-- Update create_default_roles function to also create default distribution rule
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
  
  -- Criar regra de distribuição padrão (Round Robin)
  INSERT INTO public.distribution_rules (account_id, name, rule_type, conditions, priority, is_active, is_default)
  VALUES (p_account_id, 'Distribuição Padrão (Round Robin)', 'round_robin', '{}'::jsonb, 0, true, true);
END;
$function$;