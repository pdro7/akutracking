-- Create class_logs table (per-student activity log per class)
CREATE TABLE public.class_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  project_name text,
  description text,
  where_left_off text,
  progress_level integer CHECK (progress_level BETWEEN 1 AND 5),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX class_logs_student_id_idx ON public.class_logs(student_id);
CREATE INDEX class_logs_date_idx ON public.class_logs(date DESC);

ALTER TABLE public.class_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage class logs"
  ON public.class_logs FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_class_logs_updated_at
  BEFORE UPDATE ON public.class_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
