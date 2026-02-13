
-- 1. Add session_phone to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS session_phone text;

-- 2. Add session_phone to whatsapp_messages
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS session_phone text;

-- 3. Backfill existing conversations with session phone from whatsapp_sessions
UPDATE public.whatsapp_conversations wc
SET session_phone = ws.phone_number
FROM public.whatsapp_sessions ws
WHERE ws.account_id = wc.account_id
  AND ws.phone_number IS NOT NULL
  AND wc.session_phone IS NULL;

-- 4. Backfill existing messages
UPDATE public.whatsapp_messages wm
SET session_phone = ws.phone_number
FROM public.whatsapp_sessions ws
WHERE ws.account_id = wm.account_id
  AND ws.phone_number IS NOT NULL
  AND wm.session_phone IS NULL;

-- 5. Add 'conversations' to permission_category enum
ALTER TYPE public.permission_category ADD VALUE IF NOT EXISTS 'conversations';
