-- Function to log lead activities automatically
CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_desc TEXT;
  user_name TEXT;
  user_id UUID;
BEGIN
  -- Get the current user id
  user_id := auth.uid();
  
  -- Get the user's full name from profiles
  SELECT full_name INTO user_name 
  FROM public.profiles 
  WHERE profiles.user_id = auth.uid();
  
  -- If no name found, use a default
  IF user_name IS NULL THEN
    user_name := 'Sistema';
  END IF;

  -- Handle INSERT (new lead created)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_activities (
      lead_id, 
      account_id, 
      activity_type, 
      description, 
      created_by
    ) VALUES (
      NEW.id,
      NEW.account_id,
      'created',
      'Lead criado por ' || user_name,
      user_id
    );
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Status changed
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
      DECLARE
        old_status_name TEXT;
        new_status_name TEXT;
      BEGIN
        SELECT name INTO old_status_name FROM public.lead_status WHERE id = OLD.status_id;
        SELECT name INTO new_status_name FROM public.lead_status WHERE id = NEW.status_id;
        
        INSERT INTO public.lead_activities (
          lead_id,
          account_id,
          activity_type,
          description,
          old_value,
          new_value,
          created_by
        ) VALUES (
          NEW.id,
          NEW.account_id,
          'status_changed',
          'Status alterado por ' || user_name,
          COALESCE(old_status_name, 'Nenhum'),
          COALESCE(new_status_name, 'Nenhum'),
          user_id
        );
      END;
    END IF;

    -- Temperature changed
    IF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
      DECLARE
        old_temp TEXT;
        new_temp TEXT;
      BEGIN
        old_temp := CASE OLD.temperature 
          WHEN 'hot' THEN 'Quente'
          WHEN 'warm' THEN 'Morno'
          WHEN 'cold' THEN 'Frio'
          ELSE 'Morno'
        END;
        new_temp := CASE NEW.temperature 
          WHEN 'hot' THEN 'Quente'
          WHEN 'warm' THEN 'Morno'
          WHEN 'cold' THEN 'Frio'
          ELSE 'Morno'
        END;
        
        INSERT INTO public.lead_activities (
          lead_id,
          account_id,
          activity_type,
          description,
          old_value,
          new_value,
          created_by
        ) VALUES (
          NEW.id,
          NEW.account_id,
          'temperature_changed',
          'Temperatura alterada por ' || user_name,
          old_temp,
          new_temp,
          user_id
        );
      END;
    END IF;

    -- Name changed
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      INSERT INTO public.lead_activities (
        lead_id,
        account_id,
        activity_type,
        description,
        old_value,
        new_value,
        created_by
      ) VALUES (
        NEW.id,
        NEW.account_id,
        'note_added',
        'Nome alterado por ' || user_name,
        OLD.name,
        NEW.name,
        user_id
      );
    END IF;

    -- Phone changed
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      INSERT INTO public.lead_activities (
        lead_id,
        account_id,
        activity_type,
        description,
        old_value,
        new_value,
        created_by
      ) VALUES (
        NEW.id,
        NEW.account_id,
        'note_added',
        'Telefone alterado por ' || user_name,
        OLD.phone,
        NEW.phone,
        user_id
      );
    END IF;

    -- Email changed
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      INSERT INTO public.lead_activities (
        lead_id,
        account_id,
        activity_type,
        description,
        old_value,
        new_value,
        created_by
      ) VALUES (
        NEW.id,
        NEW.account_id,
        'note_added',
        'Email alterado por ' || user_name,
        COALESCE(OLD.email, 'Vazio'),
        COALESCE(NEW.email, 'Vazio'),
        user_id
      );
    END IF;

    -- Observações changed
    IF OLD.observacoes IS DISTINCT FROM NEW.observacoes THEN
      INSERT INTO public.lead_activities (
        lead_id,
        account_id,
        activity_type,
        description,
        created_by
      ) VALUES (
        NEW.id,
        NEW.account_id,
        'note_added',
        'Observações atualizadas por ' || user_name,
        user_id
      );
    END IF;

    -- Interesse changed
    IF OLD.interesse IS DISTINCT FROM NEW.interesse THEN
      INSERT INTO public.lead_activities (
        lead_id,
        account_id,
        activity_type,
        description,
        old_value,
        new_value,
        created_by
      ) VALUES (
        NEW.id,
        NEW.account_id,
        'note_added',
        'Interesse alterado por ' || user_name,
        COALESCE(OLD.interesse, 'Vazio'),
        COALESCE(NEW.interesse, 'Vazio'),
        user_id
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Create the trigger on leads table
DROP TRIGGER IF EXISTS on_lead_change ON public.leads;
CREATE TRIGGER on_lead_change
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_activity();