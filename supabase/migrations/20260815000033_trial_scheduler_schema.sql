-- Agendador propio de clases de prueba — esquema base.
--
-- Sustituye a Calendly. El admin configura ventanas recurrentes (qué días
-- y a qué horas se pueden agendar pruebas); la disponibilidad de los
-- profesores en teachers.availability es sólo una SUGERENCIA para poblar
-- estas ventanas, nunca la fuente de los huecos ofrecidos.
--
-- leads sigue siendo la fuente de verdad de LECTURA: trial_bookings es la
-- capa de escritura y concurrencia, y un trigger unidireccional sincroniza
-- bookings -> leads. Así TrialLeads, Schedule, TeacherTrials, Dashboard y
-- LeadDetail no cambian ni una query.

-- ── Ventanas recurrentes ──────────────────────────────────────────────────
create table public.trial_windows (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0=domingo, como extract(dow)
  start_time time not null,
  end_time   time not null,
  capacity   smallint not null default 1 check (capacity >= 1),
  is_active  boolean not null default true,
  -- id del catálogo en src/lib/timeSlots.ts si la ventana nació de la
  -- sugerencia desde teachers.availability. Informativo: el cruce con la
  -- disponibilidad del profe se hace por solapamiento horario, no por este id.
  source_slot_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (weekday, start_time, end_time)
);

-- ── Excepciones puntuales por fecha ───────────────────────────────────────
-- 'block' cierra (vacaciones, un sábado suelto); 'open' abre algo que la
-- ventana recurrente no cubre.
create table public.trial_window_exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_date date not null,
  start_time time,          -- null = todo el día
  end_time   time,
  kind text not null check (kind in ('block','open')),
  reason text,
  created_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);
create index ix_trial_window_exceptions_date
  on public.trial_window_exceptions (exception_date);

-- ── La reserva ────────────────────────────────────────────────────────────
create table public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  scheduled_date date not null,
  scheduled_start_time time not null,
  scheduled_end_time   time not null,
  status text not null default 'booked'
    check (status in ('booked','cancelled','attended','no_show')),
  source text not null default 'public_self'
    check (source in ('public_self','admin','pablo','calendly','import')),
  course_id uuid references public.virtual_courses(id) on delete set null,
  -- Token no adivinable para que el padre gestione su propia reserva sin
  -- login, mismo patrón que leads.form_token (20260705000022).
  manage_token uuid not null default gen_random_uuid(),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_time > scheduled_start_time)
);

-- GARANTÍA DURA ANTI-DOBLE-RESERVA. El advisory lock del RPC es la primera
-- línea; este índice es el que no se puede saltar nadie, ni siquiera una
-- escritura que no pase por el RPC.
create unique index ux_trial_bookings_slot
  on public.trial_bookings (teacher_id, scheduled_date, scheduled_start_time)
  where status = 'booked';

-- Un solo trial activo por lead.
create unique index ux_trial_bookings_lead_active
  on public.trial_bookings (lead_id)
  where status = 'booked';

create unique index ux_trial_bookings_manage_token
  on public.trial_bookings (manage_token);

create index ix_trial_bookings_date
  on public.trial_bookings (scheduled_date)
  where status = 'booked';

-- ── Sincronización bookings -> leads (una sola dirección) ─────────────────
-- No hay trigger inverso a propósito: todas las escrituras de trial pasan
-- por book_trial_slot(). Los inputs de fecha/hora de TrialLeadDetail ya
-- están disabled/readOnly, así que no queda ninguna vía suelta que rescatar.
create or replace function public.sync_lead_from_trial_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'booked' then
    update public.leads set
      trial_class_date = new.scheduled_date,
      trial_class_time = new.scheduled_start_time,
      trial_teacher_id = new.teacher_id,
      trial_course_id  = coalesce(new.course_id, trial_course_id),
      -- No pisar un lead que ya avanzó en el embudo (enrolled, etc.).
      status = case
                 when status in ('new','contacted','interested','trial_cancelled')
                 then 'trial_scheduled'::lead_status
                 else status
               end,
      updated_at = now()
    where id = new.lead_id;

  elsif new.status = 'cancelled' then
    update public.leads
       set status = 'trial_cancelled'::lead_status, updated_at = now()
     where id = new.lead_id
       and status = 'trial_scheduled';

  elsif new.status in ('attended','no_show') then
    update public.leads set
      status = (case new.status
                  when 'attended' then 'trial_attended'
                  else 'trial_no_show'
                end)::lead_status,
      updated_at = now()
    where id = new.lead_id;
  end if;

  return new;
end $$;

create trigger trg_sync_lead_from_trial_booking
  after insert or update of status, scheduled_date, scheduled_start_time, teacher_id
  on public.trial_bookings
  for each row
  execute function public.sync_lead_from_trial_booking();

-- ── updated_at ────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_touch_trial_windows before update on public.trial_windows
  for each row execute function public.touch_updated_at();
create trigger trg_touch_trial_bookings before update on public.trial_bookings
  for each row execute function public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Patrón dominante del proyecto: authenticated gestiona, la autorización
-- fina (teacher vs admin) se hace en la UI. Sin políticas para anon: el
-- público entra siempre por edge function con service role.
alter table public.trial_windows           enable row level security;
alter table public.trial_window_exceptions enable row level security;
alter table public.trial_bookings          enable row level security;

create policy "authenticated_manage_trial_windows"
  on public.trial_windows for all to authenticated using (true) with check (true);
create policy "authenticated_manage_trial_window_exceptions"
  on public.trial_window_exceptions for all to authenticated using (true) with check (true);
create policy "authenticated_manage_trial_bookings"
  on public.trial_bookings for all to authenticated using (true) with check (true);

-- ── Parámetros de agendamiento ────────────────────────────────────────────
alter table public.settings
  add column if not exists trial_min_lead_hours int not null default 24,
  add column if not exists trial_horizon_days   int not null default 21,
  add column if not exists trial_duration_minutes int not null default 45;
