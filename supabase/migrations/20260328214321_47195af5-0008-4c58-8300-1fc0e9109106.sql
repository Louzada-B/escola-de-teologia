CREATE POLICY "Admins can upload course files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can delete course files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can update course files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role
  )
);