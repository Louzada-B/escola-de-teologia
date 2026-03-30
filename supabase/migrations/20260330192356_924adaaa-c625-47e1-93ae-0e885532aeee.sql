
CREATE TABLE public.course_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  liked_most text NOT NULL,
  improvements text NOT NULL,
  professors_rating integer NOT NULL CHECK (professors_rating BETWEEN 1 AND 5),
  would_recommend boolean NOT NULL,
  additional_comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_evaluations ENABLE ROW LEVEL SECURITY;

-- Unique: one evaluation per user per cohort
CREATE UNIQUE INDEX course_evaluations_user_cohort ON public.course_evaluations(user_id, cohort_id);

-- Students can insert their own evaluation
CREATE POLICY "Users can insert own evaluation"
  ON public.course_evaluations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Students can view their own evaluations
CREATE POLICY "Users can view own evaluations"
  ON public.course_evaluations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all evaluations
CREATE POLICY "Admins can view all evaluations"
  ON public.course_evaluations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
