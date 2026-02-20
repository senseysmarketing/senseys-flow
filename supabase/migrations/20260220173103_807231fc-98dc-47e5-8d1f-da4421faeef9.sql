-- First, unassign leads from the orphan user, then delete profile
UPDATE leads SET assigned_broker_id = NULL WHERE assigned_broker_id = '921060f6-6992-439b-ac9c-9c2b7cbb9f26';
DELETE FROM profiles WHERE user_id = '921060f6-6992-439b-ac9c-9c2b7cbb9f26';