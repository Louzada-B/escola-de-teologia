
-- TCC Settings (one row, managed by professor/admin)
CREATE TABLE public.tcc_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accept_from date,
  deadline date,
  template_path text,
  template_name text,
  instructions text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);

ALTER TABLE public.tcc_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tcc settings" ON public.tcc_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Professors can manage tcc settings" ON public.tcc_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));
CREATE POLICY "Admins can manage tcc settings" ON public.tcc_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- TCC Submissions
CREATE TABLE public.tcc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id),
  file_path text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cohort_id)
);

ALTER TABLE public.tcc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own tcc" ON public.tcc_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending tcc" ON public.tcc_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users can view own tcc" ON public.tcc_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Professors can view all tcc" ON public.tcc_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));
CREATE POLICY "Professors can update tcc" ON public.tcc_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));
CREATE POLICY "Admins can view all tcc" ON public.tcc_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update tcc" ON public.tcc_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete tcc" ON public.tcc_submissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Professors can delete tcc" ON public.tcc_submissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));
