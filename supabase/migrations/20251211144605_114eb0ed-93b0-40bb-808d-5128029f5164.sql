-- Criar função para mapeamentos Meta CAPI padrão
CREATE OR REPLACE FUNCTION public.create_default_meta_mappings(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_id UUID;
  v_mapping_exists BOOLEAN;
BEGIN
  SELECT id INTO v_status_id FROM public.lead_status 
  WHERE account_id = p_account_id AND name = 'Novo Lead';
  IF v_status_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.meta_event_mappings mem WHERE mem.account_id = p_account_id AND mem.status_id = v_status_id) INTO v_mapping_exists;
    IF NOT v_mapping_exists THEN
      INSERT INTO public.meta_event_mappings (account_id, status_id, event_name, lead_type, is_active)
      VALUES (p_account_id, v_status_id, 'Lead', NULL, true);
    END IF;
  END IF;

  SELECT id INTO v_status_id FROM public.lead_status 
  WHERE account_id = p_account_id AND name = 'Em Contato';
  IF v_status_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.meta_event_mappings mem WHERE mem.account_id = p_account_id AND mem.status_id = v_status_id) INTO v_mapping_exists;
    IF NOT v_mapping_exists THEN
      INSERT INTO public.meta_event_mappings (account_id, status_id, event_name, lead_type, is_active)
      VALUES (p_account_id, v_status_id, 'Contact', NULL, true);
    END IF;
  END IF;

  SELECT id INTO v_status_id FROM public.lead_status 
  WHERE account_id = p_account_id AND name = 'Qualificado';
  IF v_status_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.meta_event_mappings mem WHERE mem.account_id = p_account_id AND mem.status_id = v_status_id) INTO v_mapping_exists;
    IF NOT v_mapping_exists THEN
      INSERT INTO public.meta_event_mappings (account_id, status_id, event_name, lead_type, is_active)
      VALUES (p_account_id, v_status_id, 'Lead', 'qualified', true);
    END IF;
  END IF;

  SELECT id INTO v_status_id FROM public.lead_status 
  WHERE account_id = p_account_id AND name = 'Visita Agendada';
  IF v_status_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.meta_event_mappings mem WHERE mem.account_id = p_account_id AND mem.status_id = v_status_id) INTO v_mapping_exists;
    IF NOT v_mapping_exists THEN
      INSERT INTO public.meta_event_mappings (account_id, status_id, event_name, lead_type, is_active)
      VALUES (p_account_id, v_status_id, 'Schedule', NULL, true);
    END IF;
  END IF;

  SELECT id INTO v_status_id FROM public.lead_status 
  WHERE account_id = p_account_id AND name = 'Proposta';
  IF v_status_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.meta_event_mappings mem WHERE mem.account_id = p_account_id AND mem.status_id = v_status_id) INTO v_mapping_exists;
    IF NOT v_mapping_exists THEN
      INSERT INTO public.meta_event_mappings (account_id, status_id, event_name, lead_type, is_active)
      VALUES (p_account_id, v_status_id, 'SubmitApplication', NULL, true);
    END IF;
  END IF;

  SELECT id INTO v_status_id FROM public.lead_status 
  WHERE account_id = p_account_id AND name = 'Fechado';
  IF v_status_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.meta_event_mappings mem WHERE mem.account_id = p_account_id AND mem.status_id = v_status_id) INTO v_mapping_exists;
    IF NOT v_mapping_exists THEN
      INSERT INTO public.meta_event_mappings (account_id, status_id, event_name, lead_type, is_active)
      VALUES (p_account_id, v_status_id, 'Purchase', 'converted', true);
    END IF;
  END IF;
END;
$function$;