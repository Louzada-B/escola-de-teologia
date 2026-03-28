
-- Attendance settings: location config for the school
CREATE TABLE public.attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 200,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attendance settings"
  ON public.attendance_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Professors can manage attendance settings"
  ON public.attendance_settings FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor')
  );

-- Attendance records
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  checked_in_at timestamp with time zone NOT NULL DEFAULT now(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON public.attendance_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professors can view all attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor')
  );

-- Unique constraint: one attendance per user per lesson
ALTER TABLE public.attendance_records ADD CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_id);
