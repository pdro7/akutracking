-- M12: Add fields captured from the Google Forms enrollment form
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_cedula text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS age_at_enrollment integer,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS course_interest text,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean NOT NULL DEFAULT false;
