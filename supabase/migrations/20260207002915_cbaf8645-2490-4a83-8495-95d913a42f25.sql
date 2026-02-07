-- Permitir usuários inserir na fila da própria conta
CREATE POLICY "Users can insert in own account queue" 
ON public.whatsapp_message_queue 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());