-- Fix: trial_windows.capacity no se estaba aplicando.
--
-- seats_left era least(capacity, profesores_libres). Como cada reserva sólo
-- ocupa a UN profesor, con 10 profes activos una ventana de capacity = 1
-- admitía 10 reservas a la misma hora: el hueco nunca se agotaba.
--
-- Ahora se descuentan las reservas ya existentes en esa franja, incluidas
-- las que aún viven sólo en leads (Calendly / histórico), que es lo que
-- hace que capacity signifique algo.

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
    select d.slot_date, w.start_time, w.end_time, w.capacity
      from days d
      join public.trial_windows w
        on w.is_active
       and w.weekday = extract(dow from d.slot_date)::smallint
    union
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
       (c.slot_date + c.start_time) >= (v_now + make_interval(hours => v_lead_hours))
       and not (c.slot_date::text = any (v_holidays))
       and not exists (
         select 1 from public.trial_window_exceptions x
          where x.kind = 'block'
            and x.exception_date = c.slot_date
            and (
              x.start_time is null
              or (x.start_time, coalesce(x.end_time, time '23:59'))
                 overlaps (c.start_time, c.end_time)
            )
       )
  )
  select a.slot_date,
         a.start_time,
         a.end_time,
         least(a.capacity - k.taken, f.free_count)::int as seats_left
    from allowed a
    cross join lateral (
      select count(*)::int as free_count
        from public.trial_free_teachers(a.slot_date, a.start_time, a.end_time)
    ) f
    cross join lateral (
      select (
        (select count(*) from public.trial_bookings b
          where b.status = 'booked'
            and b.scheduled_date = a.slot_date
            and b.scheduled_start_time = a.start_time)
        +
        (select count(*) from public.leads l
          where l.status = 'trial_scheduled'
            and l.trial_class_date = a.slot_date
            and l.trial_class_time = a.start_time
            and not exists (select 1 from public.trial_bookings b2
                             where b2.lead_id = l.id and b2.status = 'booked'))
      )::int as taken
    ) k
   where f.free_count > 0
     and (a.capacity - k.taken) > 0
   order by a.slot_date, a.start_time;
end $$;
