
-- Tabela de controle de automação WhatsApp (Máquina de Estados)
CREATE TABLE public.whatsapp_automation_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  automation_rule_id UUID REFERENCES public.whatsapp_automation_rules(id),
  
  -- Máquina de estados
  current_phase TEXT NOT NULL DEFAULT 'greeting',
  current_step_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  
  next_execution_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Identificação determinística
  phone TEXT NOT NULL,
  remote_jid TEXT,
  jid_locked BOOLEAN DEFAULT false,
  
  -- Snapshot imutável da sequência
  steps_snapshot JSONB NOT NULL DEFAULT '{}',
  
  last_sent_message_id TEXT,
  total_messages_sent INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para o worker (lock otimista)
CREATE INDEX idx_automation_control_worker 
  ON public.whatsapp_automation_control(status, next_execution_at) 
  WHERE status IN ('active', 'processing');

-- Prevenir duplicatas ativas por lead+rule
CREATE UNIQUE INDEX idx_automation_control_lead_rule 
  ON public.whatsapp_automation_control(lead_id, automation_rule_id)
  WHERE status IN ('active', 'processing');

-- Índice para busca por account_id
CREATE INDEX idx_automation_control_account 
  ON public.whatsapp_automation_control(account_id);

-- RLS
ALTER TABLE public.whatsapp_automation_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.whatsapp_automation_control
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users view own account" ON public.whatsapp_automation_control
  FOR SELECT USING (account_id = get_user_account_id());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_automation_control_updated_at
  BEFORE UPDATE ON public.whatsapp_automation_control
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
