
ALTER TABLE public.quiz_questions 
ADD COLUMN question_type text NOT NULL DEFAULT 'objetiva',
ADD COLUMN expected_text text;
