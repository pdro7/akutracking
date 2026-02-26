-- M7: Create virtual_courses catalog
CREATE TABLE IF NOT EXISTS public.virtual_courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  next_course_id uuid REFERENCES public.virtual_courses(id),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Pre-seed courses
INSERT INTO public.virtual_courses (code, name) VALUES
  ('RCZ',  'Real Coders Zero'),
  ('RC1',  'Real Coders 1'),
  ('RC2',  'Real Coders 2'),
  ('MC1',  'Minecraft Coders 1'),
  ('MC2',  'Minecraft Coders 2'),
  ('PGZ',  'Python Zero'),
  ('PG1',  'Python Games 1'),
  ('PG2',  'Python Games 2'),
  ('PG3',  'Python Games 3'),
  ('RBX1', 'Roblox 1'),
  ('RBX2', 'Roblox 2'),
  ('UNI1', 'Unity 1'),
  ('UNI2', 'Unity 2'),
  ('YT1',  'YouTube Creator 1'),
  ('YT2',  'YouTube Creator 2'),
  ('IA1',  'IA Fundamentos 1'),
  ('IAG1', 'IA Generativa 1'),
  ('IAG2', 'IA Generativa 2')
ON CONFLICT (code) DO NOTHING;

-- RLS
ALTER TABLE public.virtual_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_virtual_courses"
  ON public.virtual_courses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin_manage_virtual_courses"
  ON public.virtual_courses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
