-- Capture why and when a student was archived so we can look back
-- ("was this the same family that left in June?") and audit who
-- pressed the button.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
