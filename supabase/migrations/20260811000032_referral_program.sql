-- Referral program schema.
--
-- Each active student can have one referral code. When a parent shares
-- their link (/r/<code>), the code lands in the target family's
-- localStorage; when they submit the /interes form, the edge function
-- resolves the code to a student_id and stores it on the lead.
--
-- Credit is earned when a referred lead reaches status 'enrolled'.
-- Application is a manual admin action recorded via
-- leads.referral_credit_applied_at.

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_id)
);

alter table public.referral_codes enable row level security;

create policy "auth_manage_referral_codes"
  on public.referral_codes for all
  to authenticated using (true) with check (true);

-- Lead attribution. Nullable — most leads are not referred.
alter table public.leads
  add column if not exists referred_by_student_id uuid
    references public.students(id) on delete set null,
  add column if not exists referral_credit_applied_at timestamptz;

create index if not exists leads_referred_by_student_idx
  on public.leads (referred_by_student_id)
  where referred_by_student_id is not null;

-- Amount of credit per successful referral (COP). Kept in settings so
-- admin can adjust without a code change.
alter table public.settings
  add column if not exists referral_credit_cop int not null default 50000;
