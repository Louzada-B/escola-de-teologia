-- Flag de super admin (acesso multi-curso, fora do escopo de admin/professor
-- de um curso só). Fica em profiles (não em auth.users) pra dar pra usar
-- direto em políticas de RLS, do mesmo jeito que role já é usado hoje.
ALTER TABLE public.profiles ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;
