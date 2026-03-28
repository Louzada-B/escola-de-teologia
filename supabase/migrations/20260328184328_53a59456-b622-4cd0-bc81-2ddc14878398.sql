
-- Admin can insert attendance records
CREATE POLICY "Admins can insert attendance records"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
  )
);

-- Admin can delete attendance records
CREATE POLICY "Admins can delete attendance records"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
  )
);
