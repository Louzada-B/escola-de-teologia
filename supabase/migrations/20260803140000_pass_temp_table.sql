-- Tabela que guarda a senha provisória (texto puro) de alunos que ainda não
-- trocaram a senha gerada no convite. Existe só pra permitir reenviar a MESMA
-- senha em vez de gerar uma nova a cada reenvio (evitar aluno com dois e-mails
-- de senhas diferentes). A linha do usuário é apagada assim que ele troca a
-- própria senha -- a partir daí, a senha original não fica salva em nenhum lugar.

CREATE TABLE public.pass (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_temp text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pass ENABLE ROW LEVEL SECURITY;

-- Sem política de SELECT/INSERT/UPDATE para authenticated/anon -- com RLS
-- ligado e nenhuma policy permissiva, o acesso fica bloqueado por padrão pra
-- todo mundo, exceto service role (usado dentro das edge functions).
--
-- Única exceção: o próprio usuário pode apagar a própria linha -- é o que a
-- tela de perfil faz assim que ele define uma senha nova por conta própria.
CREATE POLICY "Users can delete own temp password row"
  ON public.pass FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
