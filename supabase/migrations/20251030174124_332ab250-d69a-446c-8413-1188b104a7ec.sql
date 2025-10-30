-- First, drop all dependent policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage all attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

-- Drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Update enum
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('staff', 'admin');

-- Migrate existing data
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING 
  CASE 
    WHEN role::text = 'admin' THEN 'admin'::public.app_role
    ELSE 'staff'::public.app_role
  END;

-- Drop old enum
DROP TYPE public.app_role_old CASCADE;

-- Recreate has_role function with new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate all policies
CREATE POLICY "Admins can manage all roles" 
  ON public.user_roles 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage students" 
  ON public.students 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all attendance records" 
  ON public.attendance_records 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage settings" 
  ON public.settings 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payments" 
  ON public.payments 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

-- Restrict payments view to admins only
CREATE POLICY "Only admins can view payments" 
  ON public.payments 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));