
-- Create cohorts table
CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  semester integer NOT NULL CHECK (semester IN (1, 2)),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create cohort_students table
CREATE TABLE public.cohort_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, user_id)
);

-- Enable RLS
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_students ENABLE ROW LEVEL SECURITY;

-- Cohorts: everyone can view, admin/professor can manage
CREATE POLICY "Anyone can view cohorts" ON public.cohorts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage cohorts" ON public.cohorts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

CREATE POLICY "Professors can manage cohorts" ON public.cohorts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'::app_role));

-- Cohort students: everyone can view, admin/professor can manage
CREATE POLICY "Anyone can view cohort students" ON public.cohort_students
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage cohort students" ON public.cohort_students
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

CREATE POLICY "Professors can manage cohort students" ON public.cohort_students
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'::app_role));
