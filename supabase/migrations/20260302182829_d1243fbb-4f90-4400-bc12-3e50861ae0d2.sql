
-- Backfill: recover sent messages from whatsapp_message_log into whatsapp_messages
-- Only include rows where we can construct a valid remote_jid from the lead's phone
INSERT INTO whatsapp_messages (account_id, message_id, content, media_type, is_from_me, status, timestamp, lead_id, remote_jid, phone)
SELECT 
  wml.account_id,
  wml.message_id,
  wml.message_content,
  'text',
  true,
  'sent',
  wml.sent_at,
  wml.lead_id,
  CONCAT(
    CASE 
      WHEN regexp_replace(l.phone, '\D', '', 'g') ~ '^55' THEN regexp_replace(l.phone, '\D', '', 'g')
      ELSE CONCAT('55', regexp_replace(l.phone, '\D', '', 'g'))
    END,
    '@s.whatsapp.net'
  ),
  CASE 
    WHEN regexp_replace(l.phone, '\D', '', 'g') ~ '^55' THEN regexp_replace(l.phone, '\D', '', 'g')
    ELSE CONCAT('55', regexp_replace(l.phone, '\D', '', 'g'))
  END
FROM whatsapp_message_log wml
INNER JOIN leads l ON l.id = wml.lead_id
WHERE wml.sent_at >= '2026-02-27'
  AND wml.message_id IS NOT NULL
  AND wml.delivery_status = 'sent'
  AND wml.account_id IS NOT NULL
  AND l.phone IS NOT NULL
ON CONFLICT (account_id, message_id) DO NOTHING;
