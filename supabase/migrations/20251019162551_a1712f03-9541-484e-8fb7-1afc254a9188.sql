-- Create enum for user roles
create type public.app_role as enum ('admin', 'instructor');

-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Create user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Create security definer function to check roles
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Create students table
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

-- Create attendance_records table
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

-- Create settings table
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  default_pack_size int not null default 8,
  class_day text not null default 'Saturday',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.settings enable row level security;

-- Insert default settings
insert into public.settings (default_pack_size, class_day) values (8, 'Saturday');

-- RLS Policies for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- RLS Policies for user_roles
create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins can manage all roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
create policy "Authenticated users can view students"
  on public.students for select
  to authenticated
  using (true);

create policy "Admins can manage students"
  on public.students for all
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance_records
create policy "Authenticated users can view attendance"
  on public.attendance_records for select
  to authenticated
  using (true);

create policy "Authenticated users can mark attendance"
  on public.attendance_records for insert
  to authenticated
  with check (auth.uid() = marked_by);

create policy "Admins can manage all attendance records"
  on public.attendance_records for all
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for settings
create policy "Authenticated users can view settings"
  on public.settings for select
  to authenticated
  using (true);

create policy "Admins can manage settings"
  on public.settings for all
  using (public.has_role(auth.uid(), 'admin'));

-- Create function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create triggers for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

create trigger update_students_updated_at
  before update on public.students
  for each row
  execute function public.update_updated_at_column();

create trigger update_settings_updated_at
  before update on public.settings
  for each row
  execute function public.update_updated_at_column();

-- Create function to handle new user signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- Create trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();