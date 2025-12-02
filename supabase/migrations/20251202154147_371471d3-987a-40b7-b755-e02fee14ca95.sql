-- 1. Criar enum para categorias de permissão
CREATE TYPE public.permission_category AS ENUM ('leads', 'reports', 'team', 'settings', 'calendar');

-- 2. Criar tabela de permissões globais do sistema
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category permission_category NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir permissões padrão do sistema
INSERT INTO public.permissions (key, name, description, category) VALUES
-- Leads
('leads.view_own', 'Ver próprios leads', 'Visualizar apenas leads atribuídos a si', 'leads'),
('leads.view_all', 'Ver todos os leads', 'Visualizar todos os leads da conta', 'leads'),
('leads.create', 'Criar leads', 'Criar novos leads', 'leads'),
('leads.edit', 'Editar leads', 'Editar informações de leads', 'leads'),
('leads.delete', 'Excluir leads', 'Excluir leads do sistema', 'leads'),
-- Reports
('reports.view', 'Ver relatórios', 'Visualizar relatórios e métricas', 'reports'),
-- Team
('team.view', 'Ver equipe', 'Visualizar membros da equipe', 'team'),
('team.manage', 'Gerenciar equipe', 'Adicionar, editar e remover membros', 'team'),
-- Settings
('settings.view', 'Ver configurações', 'Visualizar configurações do sistema', 'settings'),
('settings.manage', 'Gerenciar configurações', 'Alterar configurações do sistema', 'settings'),
-- Calendar
('calendar.view', 'Ver agenda', 'Visualizar eventos na agenda', 'calendar'),
('calendar.manage', 'Gerenciar agenda', 'Criar e editar eventos', 'calendar');

-- 3. Criar tabela de roles por conta
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

-- 4. Criar tabela de vinculação usuário ↔ role
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 5. Criar tabela de permissões por role
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- 6. Habilitar RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 7. Criar função para obter role_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_role_id(_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_id FROM public.user_roles WHERE user_id = _user_id
$$;

-- 8. Criar função para verificar permissão
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.key = _permission_key
      AND rp.granted = true
  )
$$;

-- 9. Criar função para verificar se é owner da conta (bypass todas permissões)
CREATE OR REPLACE FUNCTION public.is_account_owner(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.name = 'Proprietário'
      AND r.is_system = true
  )
$$;

-- 10. Policies para permissions (apenas leitura para autenticados)
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (true);

-- 11. Policies para roles
CREATE POLICY "Users can view roles from their account"
ON public.roles FOR SELECT
TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users with team.manage can create roles"
ON public.roles FOR INSERT
TO authenticated
WITH CHECK (
  account_id = get_user_account_id() 
  AND (is_account_owner() OR has_permission(auth.uid(), 'team.manage'))
);

CREATE POLICY "Users with team.manage can update roles"
ON public.roles FOR UPDATE
TO authenticated
USING (
  account_id = get_user_account_id() 
  AND (is_account_owner() OR has_permission(auth.uid(), 'team.manage'))
  AND is_system = false
);

CREATE POLICY "Users with team.manage can delete roles"
ON public.roles FOR DELETE
TO authenticated
USING (
  account_id = get_user_account_id() 
  AND (is_account_owner() OR has_permission(auth.uid(), 'team.manage'))
  AND is_system = false
);

-- 12. Policies para user_roles
CREATE POLICY "Users can view user_roles from their account"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.id = role_id AND r.account_id = get_user_account_id()
  )
);

CREATE POLICY "Users with team.manage can insert user_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.id = role_id 
    AND r.account_id = get_user_account_id()
    AND (is_account_owner() OR has_permission(auth.uid(), 'team.manage'))
  )
);

CREATE POLICY "Users with team.manage can update user_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.id = role_id 
    AND r.account_id = get_user_account_id()
    AND (is_account_owner() OR has_permission(auth.uid(), 'team.manage'))
  )
);

CREATE POLICY "Users with team.manage can delete user_roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.id = role_id 
    AND r.account_id = get_user_account_id()
    AND (is_account_owner() OR has_permission(auth.uid(), 'team.manage'))
  )
);

-- 13. Policies para role_permissions
CREATE POLICY "Users can view role_permissions from their account"
ON public.role_permissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.id = role_id AND r.account_id = get_user_account_id()
  )
);

CREATE POLICY "Users with settings.manage can manage role_permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.id = role_id 
    AND r.account_id = get_user_account_id()
    AND (is_account_owner() OR has_permission(auth.uid(), 'settings.manage'))
  )
);

-- 14. Criar função para criar roles padrão para uma conta
CREATE OR REPLACE FUNCTION public.create_default_roles(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Atribuir permissões ao Gerente
  FOR perm IN SELECT id FROM public.permissions WHERE key IN (
    'leads.view_all', 'leads.create', 'leads.edit', 'leads.delete',
    'reports.view', 'team.view', 'team.manage', 'settings.view',
    'calendar.view', 'calendar.manage'
  ) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id, granted)
    VALUES (manager_role_id, perm.id, true);
  END LOOP;
  
  -- Atribuir permissões ao Corretor
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
$$;

-- 15. Atualizar função handle_new_user para criar roles e atribuir ao owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Create default lead statuses
    INSERT INTO public.lead_status (account_id, name, color, position, is_default) VALUES
    (new_account_id, 'Novo Lead', '#81afd1', 0, true),
    (new_account_id, 'Em Contato', '#a6c8e1', 1, false),
    (new_account_id, 'Qualificado', '#465666', 2, false),
    (new_account_id, 'Proposta', '#5a5f65', 3, false),
    (new_account_id, 'Negociação', '#2b2d2c', 4, false),
    (new_account_id, 'Fechado', '#22c55e', 5, false),
    (new_account_id, 'Desistiu', '#ef4444', 6, false);
    
    -- Create default roles for the account
    PERFORM public.create_default_roles(new_account_id);
    
    -- Get the owner role and assign to the new user
    SELECT id INTO owner_role_id FROM public.roles 
    WHERE account_id = new_account_id AND name = 'Proprietário';
    
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, owner_role_id);
    
    RETURN NEW;
END;
$$;