-- Create enum for trial lead status
CREATE TYPE public.trial_lead_status AS ENUM ('scheduled', 'attended', 'converted', 'cancelled');

-- Create trial leads table
CREATE TABLE public.trial_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_name TEXT NOT NULL,
  child_age INTEGER,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  trial_class_date DATE NOT NULL,
  notes TEXT,
  status trial_lead_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.trial_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view trial leads"
  ON public.trial_leads
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create trial leads"
  ON public.trial_leads
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all trial leads"
  ON public.trial_leads
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update trigger
CREATE TRIGGER update_trial_leads_updated_at
  BEFORE UPDATE ON public.trial_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();