-- Torna template_id opcional (removemos gestão de templates)
ALTER TABLE public.issued_certificates
  ALTER COLUMN template_id DROP NOT NULL;

-- Rastreia se o e-mail foi enviado com sucesso
ALTER TABLE public.issued_certificates
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
