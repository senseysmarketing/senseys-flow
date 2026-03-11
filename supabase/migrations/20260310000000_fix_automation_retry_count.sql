-- Migration: Fix automation control retry limit
-- Adds retry_count column and cleans up stuck automations that have been looping.

-- 1. Add retry_count column to track send attempts
ALTER TABLE whatsapp_automation_control
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

-- 2. Clean up automations stuck in infinite retry loops.
--    Marks as failed any 'active' automation where the lead has 5+ failed automation
--    deliveries in whatsapp_message_log, indicating the number is invalid or unreachable.
UPDATE whatsapp_automation_control wac
SET
  status             = 'failed',
  conversation_state = 'automation_finished',
  updated_at         = now()
WHERE
  wac.status = 'active'
  AND (
    SELECT count(*)
    FROM whatsapp_message_log wml
    WHERE wml.lead_id        = wac.lead_id
      AND wml.delivery_status = 'failed'
      AND wml.send_type       = 'automation'
  ) >= 5;

-- 3. Also mark as failed automations that have been in 'active' / 'processing' state
--    for an unusually long time without progress (safety net for edge cases not caught above).
--    Conservative threshold: created more than 7 days ago and still stuck in new_lead state.
UPDATE whatsapp_automation_control
SET
  status             = 'failed',
  conversation_state = 'automation_finished',
  updated_at         = now()
WHERE
  status             IN ('active', 'processing')
  AND conversation_state = 'new_lead'
  AND created_at         < now() - interval '7 days';
