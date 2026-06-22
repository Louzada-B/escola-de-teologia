-- Adiciona suporte a turma específica e agendamento de avisos

ALTER TABLE public.announcements
  ADD COLUMN cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Avisos existentes já publicados: mantém scheduled_at = created_at
UPDATE public.announcements SET scheduled_at = created_at;

-- Índice para consultas por turma e data
CREATE INDEX idx_announcements_cohort ON public.announcements(cohort_id);
CREATE INDEX idx_announcements_scheduled ON public.announcements(scheduled_at);
