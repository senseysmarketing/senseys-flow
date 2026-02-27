
-- 1. Backfill session_phone nas conversas existentes
UPDATE whatsapp_conversations wc
SET session_phone = ws.phone_number
FROM whatsapp_sessions ws
WHERE wc.account_id = ws.account_id
  AND wc.session_phone IS NULL
  AND ws.phone_number IS NOT NULL;

-- 2. Remover duplicatas (manter a mais antiga)
DELETE FROM whatsapp_messages
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY account_id, message_id
      ORDER BY created_at ASC
    ) as rn
    FROM whatsapp_messages
    WHERE message_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- 3. Criar UNIQUE index parcial para idempotência
CREATE UNIQUE INDEX idx_whatsapp_messages_unique_msg
  ON whatsapp_messages(account_id, message_id)
  WHERE message_id IS NOT NULL;
