-- Fase 3 (1/3): novo valor de role pra quem entra por código, sem conta de
-- verdade. Fica em migration separada da que passa a USAR esse valor --
-- Postgres exige que um valor novo de enum já esteja "comitado" antes de
-- ser referenciado dentro da mesma transação de outra migration.
ALTER TYPE public.app_role ADD VALUE 'participante';
