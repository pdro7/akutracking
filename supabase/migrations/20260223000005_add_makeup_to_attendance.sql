-- Add make-up class fields to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS is_makeup boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS makeup_reason text;
