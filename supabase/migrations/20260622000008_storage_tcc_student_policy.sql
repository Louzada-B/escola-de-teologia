-- Alunos podem fazer upload do TCC na pasta tcc/{user_id}/
CREATE POLICY "Students can upload own tcc file"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = 'tcc'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Alunos podem deletar/substituir o próprio arquivo de TCC
CREATE POLICY "Students can delete own tcc file"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = 'tcc'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
