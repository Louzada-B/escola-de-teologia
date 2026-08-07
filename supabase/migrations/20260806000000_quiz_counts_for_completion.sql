-- Permite marcar um questionário como "não conta" para o cálculo dos 75%
-- obrigatórios de questionários (elegibilidade de certificado/conclusão).
-- Default true preserva o comportamento atual para todo questionário já
-- existente -- nada muda até um professor desmarcar isso manualmente.
ALTER TABLE public.quizzes ADD COLUMN counts_for_completion boolean NOT NULL DEFAULT true;
