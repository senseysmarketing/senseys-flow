-- Sessoes WhatsApp conectadas por conta
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected',
  qr_code TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

-- Regras de automacao de WhatsApp
CREATE TABLE whatsapp_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  delay_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fila de mensagens para envio
CREATE TABLE whatsapp_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  automation_rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualizar whatsapp_message_log para incluir tipo de envio
ALTER TABLE whatsapp_message_log 
ADD COLUMN IF NOT EXISTS send_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS message_id TEXT,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';

-- whatsapp_sessions RLS
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account sessions"
ON whatsapp_sessions FOR SELECT
USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can manage own account sessions"
ON whatsapp_sessions FOR ALL
USING (account_id = public.get_user_account_id());

CREATE POLICY "Service role can manage all sessions"
ON whatsapp_sessions FOR ALL
USING (auth.role() = 'service_role');

-- whatsapp_automation_rules RLS
ALTER TABLE whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account rules"
ON whatsapp_automation_rules FOR SELECT
USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can manage own account rules"
ON whatsapp_automation_rules FOR ALL
USING (account_id = public.get_user_account_id());

CREATE POLICY "Service role can manage all rules"
ON whatsapp_automation_rules FOR ALL
USING (auth.role() = 'service_role');

-- whatsapp_message_queue RLS
ALTER TABLE whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account queue"
ON whatsapp_message_queue FOR SELECT
USING (account_id = public.get_user_account_id());

CREATE POLICY "Service role can manage queue"
ON whatsapp_message_queue FOR ALL
USING (auth.role() = 'service_role');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_sessions_updated_at
BEFORE UPDATE ON whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_automation_rules_updated_at
BEFORE UPDATE ON whatsapp_automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();