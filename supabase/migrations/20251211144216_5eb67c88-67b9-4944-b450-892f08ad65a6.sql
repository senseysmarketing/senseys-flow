-- ETAPA 1: Criar apenas as funções (sem executar)

-- Função para aplicar os 8 status padrão do funil imobiliário
CREATE OR REPLACE FUNCTION public.apply_standard_lead_statuses(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  standard_statuses JSONB := '[
    {"name": "Novo Lead", "color": "#81afd1", "position": 0, "is_default": true},
    {"name": "Em Contato", "color": "#a6c8e1", "position": 1, "is_default": false},
    {"name": "Qualificado", "color": "#22d3ee", "position": 2, "is_default": false},
    {"name": "Visita Agendada", "color": "#f59e0b", "position": 3, "is_default": false},
    {"name": "Proposta", "color": "#8b5cf6", "position": 4, "is_default": false},
    {"name": "Negociação", "color": "#ec4899", "position": 5, "is_default": false},
    {"name": "Fechado", "color": "#22c55e", "position": 6, "is_default": false},
    {"name": "Perdido", "color": "#ef4444", "position": 7, "is_default": false}
  ]'::jsonb;
  status_item JSONB;
  v_status_id UUID;
BEGIN
  FOR status_item IN SELECT * FROM jsonb_array_elements(standard_statuses)
  LOOP
    SELECT id INTO v_status_id 
    FROM public.lead_status 
    WHERE account_id = p_account_id 
      AND name = status_item->>'name';
    
    IF v_status_id IS NULL THEN
      INSERT INTO public.lead_status (account_id, name, color, position, is_default, is_system)
      VALUES (
        p_account_id,
        status_item->>'name',
        status_item->>'color',
        (status_item->>'position')::integer,
        (status_item->>'is_default')::boolean,
        true
      );
    ELSE
      UPDATE public.lead_status
      SET 
        color = status_item->>'color',
        position = (status_item->>'position')::integer,
        is_default = (status_item->>'is_default')::boolean,
        is_system = true
      WHERE id = v_status_id;
    END IF;
  END LOOP;
  
  UPDATE public.lead_status
  SET position = position + 100
  WHERE account_id = p_account_id
    AND is_system = false;
END;
$function$;