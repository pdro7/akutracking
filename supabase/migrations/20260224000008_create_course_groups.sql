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

CREATE POLICY "authenticated_manage_course_groups"
  ON public.course_groups FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
