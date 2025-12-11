-- Limpeza: Migrar leads dos status antigos para os novos e remover duplicados

-- Migrar leads de "Desqualificado" para "Perdido"
UPDATE public.leads l
SET status_id = (
  SELECT ls.id FROM public.lead_status ls 
  WHERE ls.account_id = l.account_id AND ls.name = 'Perdido'
  LIMIT 1
)
WHERE l.status_id IN (
  SELECT id FROM public.lead_status WHERE name = 'Desqualificado'
);

-- Migrar leads de "Sem Contato" para "Perdido"
UPDATE public.leads l
SET status_id = (
  SELECT ls.id FROM public.lead_status ls 
  WHERE ls.account_id = l.account_id AND ls.name = 'Perdido'
  LIMIT 1
)
WHERE l.status_id IN (
  SELECT id FROM public.lead_status WHERE name = 'Sem Contato'
);

-- Migrar leads de "Visita" para "Visita Agendada"
UPDATE public.leads l
SET status_id = (
  SELECT ls.id FROM public.lead_status ls 
  WHERE ls.account_id = l.account_id AND ls.name = 'Visita Agendada'
  LIMIT 1
)
WHERE l.status_id IN (
  SELECT id FROM public.lead_status WHERE name = 'Visita'
);

-- Remover mapeamentos Meta dos status antigos
DELETE FROM public.meta_event_mappings 
WHERE status_id IN (
  SELECT id FROM public.lead_status WHERE name IN ('Desqualificado', 'Sem Contato', 'Visita')
);

-- Remover status antigos que não são mais necessários
DELETE FROM public.lead_status WHERE name = 'Desqualificado';
DELETE FROM public.lead_status WHERE name = 'Sem Contato';
DELETE FROM public.lead_status WHERE name = 'Visita';