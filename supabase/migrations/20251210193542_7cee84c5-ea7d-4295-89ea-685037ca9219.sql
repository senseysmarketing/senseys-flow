-- Remove is_system from non-default statuses
UPDATE public.lead_status 
SET is_system = false 
WHERE name IN ('Proposta', 'Negociação', 'Desistiu', 'Qualificado');