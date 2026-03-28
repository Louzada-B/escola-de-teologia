ALTER TABLE public.quizzes
  ADD COLUMN available_from timestamp with time zone DEFAULT NULL,
  ADD COLUMN available_until timestamp with time zone DEFAULT NULL;