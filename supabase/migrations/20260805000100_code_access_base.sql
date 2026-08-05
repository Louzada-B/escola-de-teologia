-- Fase 3 (2/3): base pro fluxo sem conta.
--
-- Problema real encontrado: login anônimo do Supabase cria um auth.users
-- sem e-mail (NULL). A trigger handle_new_user tentava inserir esse NULL
-- em profiles.email, que era NOT NULL -- isso faria o login anônimo falhar
-- por completo. Corrigido aqui.

-- 1. E-mail deixa de ser obrigatório em profiles -- reflete a realidade de
-- quem entra só com nome, por código.
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- 2. Trigger atualizada: mantém o comportamento de sempre pra contas normais,
-- e agora também não quebra em cima de um NEW.email nulo. Além disso, quem
-- vem de login anônimo (NEW.is_anonymous = true) nasce com role
-- 'participante' por padrão, em vez de 'aluno' -- assim não se mistura com
-- alunos de verdade em nenhuma tela de gestão que filtra por role = 'aluno'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::app_role,
      CASE WHEN NEW.is_anonymous THEN 'participante'::app_role ELSE 'aluno'::app_role END
    )
  );
  RETURN NEW;
END;
$$;

-- 3. Código de acesso por turma (só usado por cursos com access_model = 'code')
ALTER TABLE public.cohorts ADD COLUMN access_code text UNIQUE;
