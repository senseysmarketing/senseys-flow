-- Update existing statuses to mark system ones
-- Mark these status names as system (cannot be deleted)
UPDATE public.lead_status 
SET is_system = true 
WHERE name IN ('Novo Lead', 'Em Contato', 'Visita', 'Fechado', 'Desqualificado', 'Sem Contato', 'Qualificado', 'Proposta', 'Negociação', 'Desistiu');