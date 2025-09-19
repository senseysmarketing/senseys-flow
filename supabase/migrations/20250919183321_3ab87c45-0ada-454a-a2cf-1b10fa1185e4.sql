-- Ativar realtime para a tabela leads
ALTER TABLE leads REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE leads;