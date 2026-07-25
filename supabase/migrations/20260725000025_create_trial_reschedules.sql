-- Track every trial-class reschedule so we can see how many times a
-- lead moved before actually showing up, and read the reason parents
-- gave. Without this, editing the date/time on the lead silently
-- overwrites the previous booking and we lose the audit trail.

CREATE TABLE public.trial_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  previous_date date,
  previous_time time,
  new_date date NOT NULL,
  new_time time,
  reason text,
  rescheduled_at timestamptz NOT NULL DEFAULT now(),
  rescheduled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX trial_reschedules_lead_id_idx
  ON public.trial_reschedules (lead_id, rescheduled_at DESC);

ALTER TABLE public.trial_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_trial_reschedules"
  ON public.trial_reschedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_trial_reschedules"
  ON public.trial_reschedules
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
