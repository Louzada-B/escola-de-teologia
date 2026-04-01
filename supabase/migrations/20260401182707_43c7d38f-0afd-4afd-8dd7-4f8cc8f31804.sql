
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  accessed_at timestamp with time zone NOT NULL DEFAULT now(),
  access_date date NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_access_logs_date ON public.access_logs(access_date);
CREATE INDEX idx_access_logs_user ON public.access_logs(user_id);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all access logs"
ON public.access_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Professors can view all access logs"
ON public.access_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));

CREATE POLICY "Anyone can insert own access log"
ON public.access_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
