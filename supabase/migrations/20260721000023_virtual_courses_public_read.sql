-- Public catalog: anyone (anon) can read active virtual_courses.
-- Needed so the public /interes and tokenized /preferencias forms can
-- populate the course dropdown without requiring authentication.

CREATE POLICY "public_read_active_virtual_courses"
  ON public.virtual_courses
  FOR SELECT
  TO anon
  USING (is_active = true);
