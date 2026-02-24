-- M6: Add modality column to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'presencial'
  CHECK (modality IN ('presencial', 'virtual', 'both'));
