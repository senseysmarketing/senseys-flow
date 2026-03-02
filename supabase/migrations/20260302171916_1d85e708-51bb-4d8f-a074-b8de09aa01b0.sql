
CREATE POLICY "Super admins can update form configs"
ON public.meta_form_configs
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
