
CREATE POLICY "Professors can delete attendance records"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'professor'::app_role
  )
);

CREATE POLICY "Professors can insert attendance for students"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'professor'::app_role
  )
);
