-- ══════════════════════════════════════════════════════════════════════
-- Fase 1 da evolução multi-curso.
-- Cria a base de dados pra suportar múltiplos cursos dentro do portal.
-- 100% aditivo e não-destrutivo -- nenhuma mudança visível pro usuário
-- ainda (o front continua ignorando course_id até fases futuras).
-- ══════════════════════════════════════════════════════════════════════

-- 1. Tabela de cursos
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,

  access_model text NOT NULL DEFAULT 'account' CHECK (access_model IN ('account', 'code')),

  has_attendance boolean NOT NULL DEFAULT true,
  has_quizzes boolean NOT NULL DEFAULT true,
  has_tcc boolean NOT NULL DEFAULT false,
  has_materials boolean NOT NULL DEFAULT true,
  has_testimonials boolean NOT NULL DEFAULT false,
  has_certificates boolean NOT NULL DEFAULT true,

  -- % mínimo de presença pra emitir certificado (decisão: 100 em curso de
  -- 1 dia, 75 em curso de 8 aulas) -- ainda não é lido por nenhum código,
  -- só a coluna existindo já (fase futura liga isso no send-certificate)
  certificate_min_attendance_pct integer NOT NULL DEFAULT 100,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view courses" ON public.courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin'::app_role OR profiles.is_super_admin = true)))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin'::app_role OR profiles.is_super_admin = true)));

-- 2. Vínculo admin/professor <-> curso (quem administra qual curso)
CREATE TABLE public.course_admins (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);

ALTER TABLE public.course_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage course_admins" ON public.course_admins
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true));

CREATE POLICY "Users can view own course admin links" ON public.course_admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Curso inicial: Formação Teológica -- representa tudo que já existe hoje
INSERT INTO public.courses (
  name, slug, description, access_model,
  has_attendance, has_quizzes, has_tcc, has_materials, has_testimonials, has_certificates,
  certificate_min_attendance_pct
) VALUES (
  'Formação Teológica', 'formacao-teologica',
  'Curso teológico de longa duração da Escola de Teologia.', 'account',
  true, true, true, true, true, true,
  100
);

-- 4. course_id nas tabelas existentes (nullable por enquanto, pra dar pra
-- popular antes de travar como obrigatório)
ALTER TABLE public.cohorts ADD COLUMN course_id uuid REFERENCES public.courses(id);
ALTER TABLE public.tcc_settings ADD COLUMN course_id uuid REFERENCES public.courses(id);
ALTER TABLE public.extra_materials ADD COLUMN course_id uuid REFERENCES public.courses(id);
ALTER TABLE public.announcements ADD COLUMN course_id uuid REFERENCES public.courses(id);
-- announcements fica opcional por design (nulo = aviso geral) -- as demais
-- viram obrigatórias no passo 6.

-- 5. Backfill: tudo que já existe hoje pertence à Formação Teológica
UPDATE public.cohorts
  SET course_id = (SELECT id FROM public.courses WHERE slug = 'formacao-teologica')
  WHERE course_id IS NULL;

UPDATE public.tcc_settings
  SET course_id = (SELECT id FROM public.courses WHERE slug = 'formacao-teologica')
  WHERE course_id IS NULL;

UPDATE public.extra_materials
  SET course_id = (SELECT id FROM public.courses WHERE slug = 'formacao-teologica')
  WHERE course_id IS NULL;

UPDATE public.announcements
  SET course_id = (SELECT id FROM public.courses WHERE slug = 'formacao-teologica')
  WHERE course_id IS NULL;

-- 6. NOT NULL onde faz sentido (não em announcements, que fica opcional por
-- design -- aviso geral no futuro não pertence a nenhum curso)
ALTER TABLE public.cohorts ALTER COLUMN course_id SET NOT NULL;
ALTER TABLE public.tcc_settings ALTER COLUMN course_id SET NOT NULL;
ALTER TABLE public.extra_materials ALTER COLUMN course_id SET NOT NULL;
