
-- Admin can manage modules
CREATE POLICY "Admins can manage modules"
ON public.modules FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage quiz_questions
CREATE POLICY "Admins can manage quiz questions"
ON public.quiz_questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage calendar_events
CREATE POLICY "Admins can manage events"
ON public.calendar_events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage lesson_files
CREATE POLICY "Admins can manage lesson files"
ON public.lesson_files FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage lessons
CREATE POLICY "Admins can manage lessons"
ON public.lessons FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage quizzes
CREATE POLICY "Admins can manage quizzes"
ON public.quizzes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage attendance_settings
CREATE POLICY "Admins can manage attendance settings"
ON public.attendance_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage announcements
CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));

-- Admin can manage book_promotions
CREATE POLICY "Admins can manage book promotions"
ON public.book_promotions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role));
