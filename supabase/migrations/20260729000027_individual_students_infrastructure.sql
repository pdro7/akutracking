-- Infrastructure for 1-on-1 (individual modality) students.
-- Group model doesn't fit: individuals have their own teacher, a flexible
-- weekly pattern (any number of days/times), and packs that don't run in
-- lockstep with 8 weekly sessions.

CREATE TABLE public.individual_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  current_topic text,
  weekly_pattern jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- weekly_pattern shape:
--   [{"day":"mon","start_time":"16:00","end_time":"17:00"}, ...]
-- day values: mon | tue | wed | thu | fri | sat | sun

CREATE INDEX individual_schedules_teacher_idx
  ON public.individual_schedules (teacher_id) WHERE is_active = true;

CREATE TABLE public.individual_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  scheduled_date date NOT NULL,
  scheduled_start_time time NOT NULL,
  scheduled_end_time time,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','attended','cancelled_by_parent','no_show')),
  notes text,
  -- Original date/time when this session was rescheduled from another slot.
  original_date date,
  original_time time,
  reschedule_reason text,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX individual_sessions_student_date_idx
  ON public.individual_sessions (student_id, scheduled_date);
CREATE INDEX individual_sessions_teacher_date_idx
  ON public.individual_sessions (teacher_id, scheduled_date);
CREATE INDEX individual_sessions_date_idx
  ON public.individual_sessions (scheduled_date);

ALTER TABLE public.individual_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_individual_schedules"
  ON public.individual_schedules FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_individual_sessions"
  ON public.individual_sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
