
-- Step 1: Drop the problematic partial index
DROP INDEX IF EXISTS idx_whatsapp_messages_unique_msg;

-- Step 2: Clean up any duplicate (account_id, message_id) pairs before adding constraint
DELETE FROM whatsapp_messages a
USING whatsapp_messages b
WHERE a.account_id = b.account_id
  AND a.message_id = b.message_id
  AND a.message_id IS NOT NULL
  AND a.id < b.id;

-- Step 3: Create real UNIQUE constraint
ALTER TABLE whatsapp_messages 
  ADD CONSTRAINT whatsapp_messages_account_message_unique 
  UNIQUE (account_id, message_id);
