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

CREATE POLICY "authenticated_manage_course_sessions"
  ON public.course_sessions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
