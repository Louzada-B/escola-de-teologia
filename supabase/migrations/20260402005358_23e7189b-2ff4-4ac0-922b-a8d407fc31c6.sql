
-- 1. Create courses table
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active courses" ON public.courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Create course_professors junction
CREATE TABLE public.course_professors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id, user_id)
);

ALTER TABLE public.course_professors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view course professors" ON public.course_professors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage course professors" ON public.course_professors
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Add course_id to modules
ALTER TABLE public.modules ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 4. Add course_id to cohorts
ALTER TABLE public.cohorts ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 5. Add course_id to announcements
ALTER TABLE public.announcements ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 6. Add course_id to book_promotions
ALTER TABLE public.book_promotions ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 7. Add course_id to extra_materials
ALTER TABLE public.extra_materials ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 8. Add course_id to tcc_settings
ALTER TABLE public.tcc_settings ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 9. Add course_id to attendance_settings
ALTER TABLE public.attendance_settings ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 10. Add course_id to certificate_templates
ALTER TABLE public.certificate_templates ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 11. Add course_id to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 12. Add course_id to quizzes (for quizzes not linked to lessons)
ALTER TABLE public.quizzes ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- 13. Trigger for updated_at on courses
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
