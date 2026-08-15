-- Cálculo de huecos libres para clases de prueba.
--
-- Toda la lógica vive en Postgres porque la consumen varios clientes (web
-- pública, admin y más adelante Pablo) y porque la reserva necesita
-- revalidar el hueco dentro de la misma transacción que lo escribe.

-- ── Ocupación de profesores ───────────────────────────────────────────────
-- Mismas fuentes que unifica src/pages/Schedule.tsx, más un cuarto bloque
-- que es la clave de la coexistencia con Calendly.
create or replace view public.v_teacher_busy as
  -- Clases de grupo
  select cg.teacher_id,
         cs.scheduled_date as busy_date,
         cg.start_time     as busy_start,
         cg.end_time       as busy_end
    from public.course_sessions cs
    join public.course_groups cg on cg.id = cs.group_id
   where coalesce(cs.status, '') <> 'cancelled'
     and cg.teacher_id is not null
     and cg.start_time is not null
     and cg.end_time is not null

  union all

  -- Clases individuales. Ojo: esta tabla usa 'cancelled_by_parent', no
  -- 'cancelled', así que se filtra por el estado activo, no por exclusión.
  select i.teacher_id,
         i.scheduled_date,
         i.scheduled_start_time,
         coalesce(i.scheduled_end_time, i.scheduled_start_time + interval '60 minutes')
    from public.individual_sessions i
   where i.status = 'scheduled'
     and i.teacher_id is not null

  union all

  -- Pruebas ya reservadas por el agendador propio
  select b.teacher_id, b.scheduled_date, b.scheduled_start_time, b.scheduled_end_time
    from public.trial_bookings b
   where b.status = 'booked'
     and b.teacher_id is not null

  union all

  -- COEXISTENCIA: pruebas que aún viven sólo en leads (Calendly e
  -- histórico). Sin este bloque, el agendador propio vendería huecos que
  -- Calendly ya ocupó.
  select l.trial_teacher_id,
         l.trial_class_date,
         l.trial_class_time,
         l.trial_class_time + interval '90 minutes'
    from public.leads l
   where l.trial_class_date is not null
     and l.trial_class_time is not null
     and l.trial_teacher_id is not null
     and l.status = 'trial_scheduled'
     and not exists (
       select 1 from public.trial_bookings b
        where b.lead_id = l.id and b.status = 'booked'
     );

-- ── Profesores libres en una franja concreta ──────────────────────────────
create or replace function public.trial_free_teachers(
  p_date date, p_start time, p_end time
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
    from public.teachers t
   where t.is_active
     and not exists (
       select 1 from public.v_teacher_busy b
        where b.teacher_id = t.id
          and b.busy_date  = p_date
          and (b.busy_start, b.busy_end) overlaps (p_start, p_end)
     );
$$;

-- ── Huecos ofrecidos al padre ─────────────────────────────────────────────
-- Devuelve deliberadamente sin teacher_id ni nombres: el público no debe
-- ver la plantilla ni la agenda del equipo.
create or replace function public.get_trial_availability(
  p_from date default null,
  p_to   date default null
)
returns table (slot_date date, start_time time, end_time time, seats_left int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today       date;
  v_now         timestamp;
  v_lead_hours  int;
  v_horizon     int;
  v_holidays    text[];
  v_from        date;
  v_to          date;
begin
  -- Hora local de Colombia. Nunca current_date a secas: el servidor está en
  -- UTC, así que después de las 19:00 COT devolvería el día siguiente.
  v_now   := (now() at time zone 'America/Bogota');
  v_today := v_now::date;

  select coalesce(trial_min_lead_hours, 24),
         coalesce(trial_horizon_days, 21),
         coalesce(holidays, '{}')
    into v_lead_hours, v_horizon, v_holidays
    from public.settings
   limit 1;

  v_lead_hours := coalesce(v_lead_hours, 24);
  v_horizon    := coalesce(v_horizon, 21);
  v_holidays   := coalesce(v_holidays, '{}');

  v_from := greatest(coalesce(p_from, v_today), v_today);
  v_to   := least(coalesce(p_to, v_today + v_horizon), v_today + v_horizon);

  return query
  with days as (
    select d::date as slot_date
      from generate_series(v_from, v_to, interval '1 day') d
  ),
  candidates as (
    -- Ventanas recurrentes activas
    select d.slot_date, w.start_time, w.end_time, w.capacity
      from days d
      join public.trial_windows w
        on w.is_active
       and w.weekday = extract(dow from d.slot_date)::smallint

    union

    -- Aperturas puntuales
    select e.exception_date, e.start_time, e.end_time, 1::smallint
      from public.trial_window_exceptions e
     where e.kind = 'open'
       and e.start_time is not null
       and e.end_time is not null
       and e.exception_date between v_from and v_to
  ),
  allowed as (
    select c.*
      from candidates c
     where
       -- Antelación mínima
       (c.slot_date + c.start_time) >= (v_now + make_interval(hours => v_lead_hours))
       -- Feriados
       and not (c.slot_date::text = any (v_holidays))
       -- Cierres puntuales
       and not exists (
         select 1 from public.trial_window_exceptions x
          where x.kind = 'block'
            and x.exception_date = c.slot_date
            and (
              x.start_time is null   -- todo el día
              or (x.start_time, coalesce(x.end_time, time '23:59'))
                 overlaps (c.start_time, c.end_time)
            )
       )
  )
  -- LATERAL para contar los profesores libres una sola vez por hueco:
  -- el resultado se usa a la vez para filtrar y para calcular los cupos.
  select a.slot_date,
         a.start_time,
         a.end_time,
         least(a.capacity, f.free_count)::int as seats_left
    from allowed a
    cross join lateral (
      select count(*)::int as free_count
        from public.trial_free_teachers(a.slot_date, a.start_time, a.end_time)
    ) f
   where f.free_count > 0
   order by a.slot_date, a.start_time;
end $$;

-- ── Elección automática de profesor ───────────────────────────────────────
-- Reparto simple y predecible: menos pruebas esa semana, luego menos
-- ocupación ese día, luego id como desempate estable.
create or replace function public.pick_trial_teacher(
  p_date date, p_start time, p_end time
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
    from public.trial_free_teachers(p_date, p_start, p_end) t(id)
   order by (
     select count(*) from public.trial_bookings b
      where b.teacher_id = t.id
        and b.status = 'booked'
        and b.scheduled_date between date_trunc('week', p_date)::date
                                 and (date_trunc('week', p_date) + interval '6 days')::date
   ),
   (
     select count(*) from public.v_teacher_busy b
      where b.teacher_id = t.id and b.busy_date = p_date
   ),
   t.id
   limit 1;
$$;
