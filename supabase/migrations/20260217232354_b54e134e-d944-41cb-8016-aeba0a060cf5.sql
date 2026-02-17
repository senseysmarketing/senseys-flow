
-- Fix 1: Cancel pending follow-ups for Raquel (she already responded)
UPDATE whatsapp_message_queue
SET 
  status = 'cancelled',
  error_message = 'Cancelado manualmente: lead já havia respondido via @lid antes deste follow-up'
WHERE id IN (
  'd503b14e-b1db-4602-8f24-2c812f37d648',
  '1aec864c-7303-44f9-a1df-70eda28201a3'
)
AND status = 'pending';

-- Fix 2: Associate @lid messages with Raquel's correct lead_id
UPDATE whatsapp_messages
SET lead_id = '5838e031-9fe1-45ba-9447-c61e84d3b87e'
WHERE account_id = '680d6cf3-8114-4221-9f21-b0a66d3c7ae7'
AND phone = '276175070957762'
AND lead_id IS NULL;

-- Fix 3: Save lid_jid on Raquel's conversation so future @lid messages resolve automatically
UPDATE whatsapp_conversations
SET lid_jid = '276175070957762@lid'
WHERE id = '1d0788ed-a9ff-4a0f-a53f-3331e7b8451e'
AND lid_jid IS NULL;
