CREATE OR REPLACE FUNCTION public.log_lead_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  activity_desc TEXT;
  user_name TEXT;
  user_id UUID;
  temp_label TEXT;
BEGIN
  user_id := auth.uid();
  
  SELECT full_name INTO user_name 
  FROM public.profiles 
  WHERE profiles.user_id = auth.uid();
  
  IF user_name IS NULL THEN
    user_name := 'Sistema';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.origem IS NOT NULL THEN
      temp_label := CASE NEW.temperature
        WHEN 'hot' THEN 'Quente'
        WHEN 'warm' THEN 'Morno'
        WHEN 'cold' THEN 'Frio'
        ELSE 'Morno'
      END;
      activity_desc := 'Lead via ' || NEW.origem || ' - ' || temp_label;
    ELSE
      activity_desc := 'Lead criado por ' || user_name;
    END IF;

    INSERT INTO public.lead_activities (
      lead_id, account_id, activity_type, description, created_by
    ) VALUES (
      NEW.id, NEW.account_id, 'created', activity_desc, user_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
      DECLARE
        old_status_name TEXT;
        new_status_name TEXT;
      BEGIN
        SELECT name INTO old_status_name FROM public.lead_status WHERE id = OLD.status_id;
        SELECT name INTO new_status_name FROM public.lead_status WHERE id = NEW.status_id;
        
        INSERT INTO public.lead_activities (
          lead_id, account_id, activity_type, description, old_value, new_value, created_by
        ) VALUES (
          NEW.id, NEW.account_id, 'status_changed', 'Status alterado por ' || user_name,
          COALESCE(old_status_name, 'Nenhum'), COALESCE(new_status_name, 'Nenhum'), user_id
        );
      END;
    END IF;

    IF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
      DECLARE
        old_temp TEXT;
        new_temp TEXT;
      BEGIN
        old_temp := CASE OLD.temperature WHEN 'hot' THEN 'Quente' WHEN 'warm' THEN 'Morno' WHEN 'cold' THEN 'Frio' ELSE 'Morno' END;
        new_temp := CASE NEW.temperature WHEN 'hot' THEN 'Quente' WHEN 'warm' THEN 'Morno' WHEN 'cold' THEN 'Frio' ELSE 'Morno' END;
        
        INSERT INTO public.lead_activities (
          lead_id, account_id, activity_type, description, old_value, new_value, created_by
        ) VALUES (
          NEW.id, NEW.account_id, 'temperature_changed', 'Temperatura alterada por ' || user_name,
          old_temp, new_temp, user_id
        );
      END;
    END IF;

    IF OLD.name IS DISTINCT FROM NEW.name THEN
      INSERT INTO public.lead_activities (lead_id, account_id, activity_type, description, old_value, new_value, created_by)
      VALUES (NEW.id, NEW.account_id, 'note_added', 'Nome alterado por ' || user_name, OLD.name, NEW.name, user_id);
    END IF;

    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      INSERT INTO public.lead_activities (lead_id, account_id, activity_type, description, old_value, new_value, created_by)
      VALUES (NEW.id, NEW.account_id, 'note_added', 'Telefone alterado por ' || user_name, OLD.phone, NEW.phone, user_id);
    END IF;

    IF OLD.email IS DISTINCT FROM NEW.email THEN
      INSERT INTO public.lead_activities (lead_id, account_id, activity_type, description, old_value, new_value, created_by)
      VALUES (NEW.id, NEW.account_id, 'note_added', 'Email alterado por ' || user_name, COALESCE(OLD.email, 'Vazio'), COALESCE(NEW.email, 'Vazio'), user_id);
    END IF;

    IF OLD.observacoes IS DISTINCT FROM NEW.observacoes THEN
      INSERT INTO public.lead_activities (lead_id, account_id, activity_type, description, created_by)
      VALUES (NEW.id, NEW.account_id, 'note_added', 'Observações atualizadas por ' || user_name, user_id);
    END IF;

    IF OLD.interesse IS DISTINCT FROM NEW.interesse THEN
      INSERT INTO public.lead_activities (lead_id, account_id, activity_type, description, old_value, new_value, created_by)
      VALUES (NEW.id, NEW.account_id, 'note_added', 'Interesse alterado por ' || user_name, COALESCE(OLD.interesse, 'Vazio'), COALESCE(NEW.interesse, 'Vazio'), user_id);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;