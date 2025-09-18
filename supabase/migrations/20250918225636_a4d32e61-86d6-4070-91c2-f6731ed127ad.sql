-- Fix security issue with leads table RLS policy
-- The current policy could allow unauthorized access when auth.uid() is NULL

-- Drop the current policy
DROP POLICY IF EXISTS "Users can manage leads from their account" ON public.leads;

-- Create more secure policies that explicitly check authentication
CREATE POLICY "Authenticated users can view leads from their account" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Authenticated users can insert leads to their account" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Authenticated users can update leads from their account" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (account_id = get_user_account_id())
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Authenticated users can delete leads from their account" 
ON public.leads 
FOR DELETE 
TO authenticated
USING (account_id = get_user_account_id());

-- Also fix the lead_activities table while we're at it
DROP POLICY IF EXISTS "Users can view activities from their account" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can create activities for their account" ON public.lead_activities;

CREATE POLICY "Authenticated users can view activities from their account" 
ON public.lead_activities 
FOR SELECT 
TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Authenticated users can create activities for their account" 
ON public.lead_activities 
FOR INSERT 
TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Authenticated users can update activities from their account" 
ON public.lead_activities 
FOR UPDATE 
TO authenticated
USING (account_id = get_user_account_id())
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Authenticated users can delete activities from their account" 
ON public.lead_activities 
FOR DELETE 
TO authenticated
USING (account_id = get_user_account_id());