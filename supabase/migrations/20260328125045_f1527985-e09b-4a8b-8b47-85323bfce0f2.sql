
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS professor_name text,
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'aula',
  ADD COLUMN IF NOT EXISTS mandatory_attendance boolean NOT NULL DEFAULT true;
