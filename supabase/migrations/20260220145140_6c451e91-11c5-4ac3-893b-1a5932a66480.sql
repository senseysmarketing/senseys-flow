
-- Fix FK constraints: change NO ACTION to SET NULL for whatsapp_messages and whatsapp_conversations
ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT whatsapp_messages_lead_id_fkey,
  ADD CONSTRAINT whatsapp_messages_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT whatsapp_conversations_lead_id_fkey,
  ADD CONSTRAINT whatsapp_conversations_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
