-- Step 1: Delete conversations with 12-digit JIDs where a 13-digit normalized version already exists
DELETE FROM whatsapp_conversations 
WHERE phone ~ '^55[0-9]{2}[0-9]{8}$' 
  AND length(phone) = 12
  AND remote_jid LIKE '%@s.whatsapp.net'
  AND EXISTS (
    SELECT 1 FROM whatsapp_conversations c2
    WHERE c2.account_id = whatsapp_conversations.account_id
      AND c2.remote_jid = '55' || substring(whatsapp_conversations.phone from 3 for 2) || '9' || substring(whatsapp_conversations.phone from 5) || '@s.whatsapp.net'
  );

-- Step 2: Now safely normalize remaining conversations with 12-digit phones
UPDATE whatsapp_conversations 
SET remote_jid = '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5) || '@s.whatsapp.net',
    phone = '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5)
WHERE phone ~ '^55[0-9]{2}[0-9]{8}$' 
  AND length(phone) = 12
  AND remote_jid LIKE '%@s.whatsapp.net';

-- Step 3: Normalize messages with 12-digit phones (no unique constraint issue here)
UPDATE whatsapp_messages 
SET remote_jid = '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5) || '@s.whatsapp.net',
    phone = '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5)
WHERE phone ~ '^55[0-9]{2}[0-9]{8}$' 
  AND length(phone) = 12
  AND remote_jid LIKE '%@s.whatsapp.net';