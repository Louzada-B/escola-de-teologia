
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Everyone can view approved testimonials
CREATE POLICY "Anyone can view approved testimonials"
ON public.testimonials FOR SELECT TO authenticated
USING (status = 'approved');

-- Users can view their own testimonials (any status)
CREATE POLICY "Users can view own testimonials"
ON public.testimonials FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own testimonials
CREATE POLICY "Users can insert own testimonials"
ON public.testimonials FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Professors can view all testimonials
CREATE POLICY "Professors can view all testimonials"
ON public.testimonials FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));

-- Admins can view all testimonials
CREATE POLICY "Admins can view all testimonials"
ON public.testimonials FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Professors can update testimonials (approve/reject)
CREATE POLICY "Professors can update testimonials"
ON public.testimonials FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));

-- Admins can update testimonials (approve/reject)
CREATE POLICY "Admins can update testimonials"
ON public.testimonials FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Admins can delete testimonials
CREATE POLICY "Admins can delete testimonials"
ON public.testimonials FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Professors can delete testimonials
CREATE POLICY "Professors can delete testimonials"
ON public.testimonials FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));
