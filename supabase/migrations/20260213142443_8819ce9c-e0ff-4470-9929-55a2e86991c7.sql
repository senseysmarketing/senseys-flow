
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS lid_jid text;
CREATE INDEX IF NOT EXISTS idx_conversations_lid_jid 
  ON whatsapp_conversations(lid_jid) WHERE lid_jid IS NOT NULL;
