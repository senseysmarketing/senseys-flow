-- Add trigger_sources column to whatsapp_automation_rules
ALTER TABLE whatsapp_automation_rules 
ADD COLUMN IF NOT EXISTS trigger_sources jsonb DEFAULT '{"manual": true, "meta": true, "webhook": true}'::jsonb;