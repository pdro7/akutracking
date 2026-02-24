-- ============================================================
-- AKU Tracker - Full Database Setup Script
-- Run this in the Supabase SQL Editor (new project)
-- ============================================================

-- ── MIGRATION 1: Base schema ──────────────────────────────────

create type public.app_role as enum ('admin', 'instructor');

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  parent_name text not null,
  enrollment_date date not null default current_date,
  is_active boolean not null default true,
  pack_size int not null default 8,
  classes_attended int not null default 0,
  classes_remaining int not null default 8,
  last_payment_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.students enable row level security;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade not null,
  date date not null,
  attended boolean not null,
  marked_by uuid references auth.users(id) not null,
  created_at timestamptz default now() not null,
  unique (student_id, date)
);
alter table public.attendance_records enable row level security;

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  default_pack_size int not null default 8,
  class_day text not null default 'Saturday',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.settings enable row level security;
insert into public.settings (default_pack_size, class_day) values (8, 'Saturday');

-- RLS policies
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view their own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins can manage all roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated users can view students" on public.students for select to authenticated using (true);
create policy "Admins can manage students" on public.students for all using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated users can view attendance" on public.attendance_records for select to authenticated using (true);
create policy "Authenticated users can mark attendance" on public.attendance_records for insert to authenticated with check (auth.uid() = marked_by);
create policy "Admins can manage all attendance records" on public.attendance_records for all using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated users can view settings" on public.settings for select to authenticated using (true);
create policy "Admins can manage settings" on public.settings for all using (public.has_role(auth.uid(), 'admin'));

-- updated_at function and triggers
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger update_students_updated_at before update on public.students for each row execute function public.update_updated_at_column();
create trigger update_settings_updated_at before update on public.settings for each row execute function public.update_updated_at_column();

-- Handle new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── MIGRATION 3: Extra student fields ────────────────────────

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS school_name text,
  ADD COLUMN IF NOT EXISTS grade_level text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS notes text;

-- ── MIGRATION 4: Payments table ──────────────────────────────

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payments_student_id ON public.payments(student_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date DESC);

-- ── MIGRATION 5: Payment methods in settings ─────────────────

ALTER TABLE public.settings
  ADD COLUMN payment_methods text[] DEFAULT ARRAY['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi'];

-- ── MIGRATION 6: Update app_role enum ────────────────────────

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage all attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;

DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('staff', 'admin');

ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING
  CASE WHEN role::text = 'admin' THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END;

DROP TYPE public.app_role_old CASCADE;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage students" ON public.students FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all attendance records" ON public.attendance_records FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can view payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ── MIGRATION 7: Trial leads ─────────────────────────────────

CREATE TYPE public.trial_lead_status AS ENUM ('scheduled', 'attended', 'converted', 'cancelled');

CREATE TABLE public.trial_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_name TEXT NOT NULL,
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
ALTER TABLE public.trial_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view trial leads" ON public.trial_leads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create trial leads" ON public.trial_leads FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage all trial leads" ON public.trial_leads FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_trial_leads_updated_at BEFORE UPDATE ON public.trial_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── MIGRATION 8: Trial leads - date_of_birth ─────────────────

ALTER TABLE public.trial_leads ADD COLUMN date_of_birth DATE;

-- ── MIGRATION 9: Add no_show status ──────────────────────────

ALTER TYPE public.trial_lead_status ADD VALUE 'no_show';

-- ── NEW MIGRATION 1: archived field ──────────────────────────

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS students_archived_idx ON public.students(archived);

-- ── NEW MIGRATION 2: Activities catalog ──────────────────────

CREATE TABLE public.activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  area text NOT NULL CHECK (area IN ('programming', 'robotics', '3d_design', 'ai', 'other')),
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage activities" ON public.activities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── NEW MIGRATION 3: Modules ──────────────────────────────────

CREATE TABLE public.modules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read modules" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage modules" ON public.modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── NEW MIGRATION 4: Class logs ───────────────────────────────

CREATE TABLE public.class_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  project_name text,
  description text,
  where_left_off text,
  progress_level integer CHECK (progress_level BETWEEN 1 AND 5),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX class_logs_student_id_idx ON public.class_logs(student_id);
CREATE INDEX class_logs_date_idx ON public.class_logs(date DESC);
ALTER TABLE public.class_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage class logs" ON public.class_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_class_logs_updated_at BEFORE UPDATE ON public.class_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── NEW MIGRATION 5: Make-up classes ─────────────────────────

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS is_makeup boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS makeup_reason text;
