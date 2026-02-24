-- =============================================================
-- AKU Tracker — Virtual Modality Setup (M6–M11)
-- Run this in the Supabase SQL Editor to set up virtual classes.
-- =============================================================

-- M6: Add modality column to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'presencial'
  CHECK (modality IN ('presencial', 'virtual', 'both'));

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

INSERT INTO public.virtual_courses (code, name) VALUES
  ('RCZ',  'Real Coders Zero'),
  ('RC1',  'Real Coders 1'),
  ('RC2',  'Real Coders 2'),
  ('MC1',  'Micro Coders 1'),
  ('MC2',  'Micro Coders 2'),
  ('PGZ',  'Python Genesis Zero'),
  ('PG1',  'Python Genesis 1'),
  ('PG2',  'Python Genesis 2'),
  ('PG3',  'Python Genesis 3'),
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

ALTER TABLE public.virtual_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_virtual_courses" ON public.virtual_courses;
CREATE POLICY "authenticated_read_virtual_courses"
  ON public.virtual_courses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_virtual_courses" ON public.virtual_courses;
CREATE POLICY "admin_manage_virtual_courses"
  ON public.virtual_courses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- M8: Create course_groups (cohortes)
CREATE TABLE IF NOT EXISTS public.course_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  virtual_course_id uuid NOT NULL REFERENCES public.virtual_courses(id),
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming', 'active', 'completed', 'cancelled')),
  min_students integer DEFAULT 3,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.course_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_course_groups" ON public.course_groups;
CREATE POLICY "authenticated_manage_course_groups"
  ON public.course_groups FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- M9: Create course_sessions (the 8 sessions per group)
CREATE TABLE IF NOT EXISTS public.course_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.course_groups(id) ON DELETE CASCADE,
  session_number integer NOT NULL CHECK (session_number BETWEEN 1 AND 8),
  scheduled_date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (group_id, session_number)
);

ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_course_sessions" ON public.course_sessions;
CREATE POLICY "authenticated_manage_course_sessions"
  ON public.course_sessions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- M10: Create course_enrollments (student → group)
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.course_groups(id) ON DELETE CASCADE,
  enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_plan text NOT NULL DEFAULT 'full'
    CHECK (payment_plan IN ('full', 'installments')),
  installment_1_paid_at date,
  installment_1_amount numeric(10,2),
  installment_2_due_date date,
  installment_2_paid_at date,
  installment_2_amount numeric(10,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'withdrawn')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (student_id, group_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_course_enrollments" ON public.course_enrollments;
CREATE POLICY "authenticated_manage_course_enrollments"
  ON public.course_enrollments FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- M11: Add course_session_id to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS course_session_id uuid
  REFERENCES public.course_sessions(id) ON DELETE SET NULL;
