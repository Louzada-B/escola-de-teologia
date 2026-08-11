-- Leitura obrigatória por aula (texto livre, ex: "Capítulo 3 - A Trindade").
-- Aula sem esse campo preenchido não tem leitura obrigatória associada.
ALTER TABLE public.lessons ADD COLUMN required_reading text;

-- Confirmação de leitura: um registro por aluno por aula, criado quando ele
-- marca "li". confirmed_by_professor distingue confirmação feita pelo
-- próprio aluno de uma marcação manual do professor (usada quando o prazo
-- já passou e o aluno não confirmou a tempo, mas o professor quer registrar
-- mesmo assim).
CREATE TABLE public.reading_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by_professor boolean NOT NULL DEFAULT false,
  UNIQUE(lesson_id, user_id)
);

ALTER TABLE public.reading_confirmations ENABLE ROW LEVEL SECURITY;

-- Aluno vê e gerencia (marca/desmarca) só a própria confirmação -- e nunca
-- pode se auto-marcar como "confirmado pelo professor".
CREATE POLICY "Users manage own reading confirmations" ON public.reading_confirmations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND confirmed_by_professor = false);

-- Professor/admin vê e gerencia tudo, inclusive marcação manual.
CREATE POLICY "Professors manage all reading confirmations" ON public.reading_confirmations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('professor', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('professor', 'admin')));
