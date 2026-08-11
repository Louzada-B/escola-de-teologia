-- Interruptor de GPS obrigatório, por turma. Default false: presença vira
-- "boa fé" (aluno confirma sem checagem de localização) até o admin ligar
-- manualmente pra uma turma específica (update direto no banco).
ALTER TABLE public.cohorts ADD COLUMN gps_obrigatorio boolean NOT NULL DEFAULT false;
