-- Fix: allow deleting leads that have whatsapp_automation_control records
-- The original FK was created without ON DELETE CASCADE, causing a FK violation
-- when trying to delete a lead that has automation records associated.

ALTER TABLE whatsapp_automation_control
  DROP CONSTRAINT IF EXISTS whatsapp_automation_control_lead_id_fkey;

ALTER TABLE whatsapp_automation_control
  ADD CONSTRAINT whatsapp_automation_control_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
