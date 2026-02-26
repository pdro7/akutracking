-- M16: Add 'individual' to modality check constraint
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_modality_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_modality_check
  CHECK (modality IN ('presencial', 'virtual', 'both', 'individual'));
