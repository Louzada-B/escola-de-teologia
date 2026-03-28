
CREATE POLICY "Admins can view all attendance"
ON public.attendance_records FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
));

CREATE POLICY "Admins can view all quiz responses"
ON public.quiz_responses FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
));
