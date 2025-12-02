-- Adicionar campos de White Label na tabela accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Adicionar campo de temperatura na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'warm' CHECK (temperature IN ('hot', 'warm', 'cold'));

-- Criar bucket para logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Política para visualizar logos publicamente
CREATE POLICY "Logos são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Política para upload de logos (usuários autenticados da conta)
CREATE POLICY "Usuários podem fazer upload de logo da sua conta"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos' 
  AND auth.role() = 'authenticated'
);

-- Política para atualizar logos
CREATE POLICY "Usuários podem atualizar logo da sua conta"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Política para deletar logos
CREATE POLICY "Usuários podem deletar logo da sua conta"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Política para accounts poderem ser atualizadas pelo owner
CREATE POLICY "Users can update their own account"
ON public.accounts FOR UPDATE
USING (id = get_user_account_id())
WITH CHECK (id = get_user_account_id());