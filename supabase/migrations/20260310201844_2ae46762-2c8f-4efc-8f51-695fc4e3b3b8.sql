-- Cleanup: mark stuck automations as failed (those with 5+ failed attempts)
UPDATE whatsapp_automation_control wac
SET status = 'failed', conversation_state = 'automation_finished', updated_at = now()
WHERE status IN ('active', 'processing') 
AND (SELECT count(*) FROM whatsapp_message_log wml 
     WHERE wml.lead_id = wac.lead_id 
     AND wml.delivery_status = 'failed' 
     AND wml.send_type = 'automation') >= 5;