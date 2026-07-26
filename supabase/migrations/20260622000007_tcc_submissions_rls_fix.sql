-- Admin pode inserir TCC (para testes e casos excepcionais)
CREATE POLICY "Admins can insert tcc"
  ON public.tcc_submissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Corrige UPDATE para alunos: permite reenvio de submissions rejeitadas
DROP POLICY "Users can update own pending tcc" ON public.tcc_submissions;
CREATE POLICY "Users can update own tcc"
  ON public.tcc_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));
