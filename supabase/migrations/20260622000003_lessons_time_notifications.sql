-- Horário de início e fim das aulas (para janela de presença e alertas)
ALTER TABLE public.lessons
  ADD COLUMN start_time TIME,
  ADD COLUMN end_time TIME;

-- Tabela para rastrear notificações lidas por cada usuário
CREATE TABLE public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'announcement' | 'event'
  source_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_type, source_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification reads"
  ON public.notification_reads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_notification_reads_user ON public.notification_reads(user_id);
