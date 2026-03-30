
-- Create extra_materials table
CREATE TABLE public.extra_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT NOT NULL DEFAULT 'file', -- 'file', 'link', 'video'
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  external_url TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extra_materials ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "Anyone can view extra materials" ON public.extra_materials
  FOR SELECT TO authenticated USING (true);

-- Professors can manage
CREATE POLICY "Professors can manage extra materials" ON public.extra_materials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'professor'));

-- Admins can manage
CREATE POLICY "Admins can manage extra materials" ON public.extra_materials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
