-- M11: Add course_session_id to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS course_session_id uuid
  REFERENCES public.course_sessions(id) ON DELETE SET NULL;
