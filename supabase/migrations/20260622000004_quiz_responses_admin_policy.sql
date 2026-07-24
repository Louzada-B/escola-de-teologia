-- Admin pode ver todas as respostas (necessário para a página de análises)
CREATE POLICY "Admins can view all responses"
  ON public.quiz_responses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
