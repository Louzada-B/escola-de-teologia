-- Altera colunas de date para timestamptz para suportar horário
ALTER TABLE public.tcc_settings
  ALTER COLUMN accept_from TYPE timestamptz
    USING (accept_from::timestamptz),
  ALTER COLUMN deadline TYPE timestamptz
    USING ((deadline + INTERVAL '23 hours 59 minutes')::timestamptz);
