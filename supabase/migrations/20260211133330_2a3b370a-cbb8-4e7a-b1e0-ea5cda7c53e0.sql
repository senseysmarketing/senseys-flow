
-- Create whatsapp_messages table for storing conversation messages
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  remote_jid TEXT NOT NULL, -- phone@s.whatsapp.net format
  phone TEXT NOT NULL, -- cleaned phone number
  message_id TEXT, -- Evolution API message ID
  content TEXT,
  media_type TEXT, -- text, image, audio, video, document
  media_url TEXT,
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'sent', -- sent, delivered, read
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID REFERENCES public.leads(id),
  contact_name TEXT, -- push name from WhatsApp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast conversation lookups
CREATE INDEX idx_whatsapp_messages_account_phone ON public.whatsapp_messages(account_id, phone, timestamp DESC);
CREATE INDEX idx_whatsapp_messages_account_jid ON public.whatsapp_messages(account_id, remote_jid);
CREATE INDEX idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages from their account"
ON public.whatsapp_messages FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert messages to their account"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Service role can manage all messages"
ON public.whatsapp_messages FOR ALL
USING (auth.role() = 'service_role');

-- Create whatsapp_conversations view-like table for fast conversation list
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  remote_jid TEXT NOT NULL,
  phone TEXT NOT NULL,
  contact_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_is_from_me BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  lead_id UUID REFERENCES public.leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, remote_jid)
);

CREATE INDEX idx_whatsapp_conversations_account ON public.whatsapp_conversations(account_id, last_message_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations from their account"
ON public.whatsapp_conversations FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can update conversations from their account"
ON public.whatsapp_conversations FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Service role can manage all conversations"
ON public.whatsapp_conversations FOR ALL
USING (auth.role() = 'service_role');
