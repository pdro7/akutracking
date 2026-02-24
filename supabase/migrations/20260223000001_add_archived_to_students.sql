-- Add archived column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS students_archived_idx ON public.students(archived);
