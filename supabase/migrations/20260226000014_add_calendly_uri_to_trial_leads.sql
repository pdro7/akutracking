-- M14: Add calendly_uri to trial_leads for deduplication and cancellation matching
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS calendly_uri text UNIQUE;
