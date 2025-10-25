-- Add payment_methods column to settings table
ALTER TABLE public.settings 
ADD COLUMN payment_methods text[] DEFAULT ARRAY['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi'];