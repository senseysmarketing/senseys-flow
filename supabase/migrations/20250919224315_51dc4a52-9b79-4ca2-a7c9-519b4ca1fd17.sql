-- Criar edge function para adicionar usuários à mesma conta
CREATE OR REPLACE FUNCTION public.invite_user_to_account(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_target_account_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_account_id UUID;
  new_user_id UUID;
  result JSON;
BEGIN
  -- Verificar se o usuário atual pertence à conta de destino
  SELECT account_id INTO current_account_id 
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF current_account_id != p_target_account_id THEN
    RETURN json_build_object('error', 'Você não tem permissão para adicionar usuários a esta conta');
  END IF;
  
  -- Verificar se o email já existe
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) THEN
    RETURN json_build_object('error', 'Este email já está cadastrado no sistema');
  END IF;
  
  -- Esta função será chamada via edge function que criará o usuário
  -- Por enquanto, apenas validamos os dados
  RETURN json_build_object(
    'success', true,
    'message', 'Dados validados com sucesso'
  );
END;
$$;

-- Criar tabela para convites pendentes
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(email, account_id)
);

-- Enable RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Create policies for team_invites
CREATE POLICY "Users can view invites from their account" 
ON public.team_invites 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create invites for their account" 
ON public.team_invites 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update invites from their account" 
ON public.team_invites 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete invites from their account" 
ON public.team_invites 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Função para aceitar convite e atualizar o perfil do usuário
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_invite_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  invite_record public.team_invites;
  user_email TEXT;
BEGIN
  -- Pegar email do usuário atual
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  -- Buscar o convite
  SELECT * INTO invite_record 
  FROM public.team_invites 
  WHERE id = p_invite_id 
    AND email = user_email 
    AND used = false 
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Convite não encontrado ou expirado');
  END IF;
  
  -- Atualizar o perfil do usuário para usar o account_id do convite
  UPDATE public.profiles 
  SET account_id = invite_record.account_id,
      full_name = COALESCE(full_name, invite_record.full_name)
  WHERE user_id = auth.uid();
  
  -- Marcar convite como usado
  UPDATE public.team_invites 
  SET used = true 
  WHERE id = p_invite_id;
  
  RETURN json_build_object('success', true, 'message', 'Convite aceito com sucesso');
END;
$$;