-- Change child_age to date_of_birth in trial_leads table
ALTER TABLE public.trial_leads 
DROP COLUMN child_age;

ALTER TABLE public.trial_leads 
ADD COLUMN date_of_birth DATE;