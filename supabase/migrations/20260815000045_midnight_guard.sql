-- Guard de medianoche.
--
-- Una clase que empieza a las 23:00 y dura 60 min termina a las 00:00: el
-- tipo `time` da la vuelta y el resultado (00:00) queda por debajo del
-- inicio, así que la restricción scheduled_end_time > scheduled_start_time
-- falla con un error de constraint incomprensible.
--
-- Es alcanzable de verdad: basta una ventana que llegue hasta las 24:00.
-- El agendador no soporta clases que cruzan la medianoche —ni tendría
-- sentido para clases de niños—, así que:
--   * get_trial_availability descarta esos huecos (condición nueva
--     `c.end_time > c.start_time` en el CTE `allowed`)
--   * book_trial_slot en modo forzado lanza CROSSES_MIDNIGHT, que la UI
--     traduce a un mensaje legible

create or replace function public.get_trial_availability(
  p_from date default null,
  p_to   date default null
)
returns table (slot_date date, start_time time, end_time time, seats_left int, capacity int)
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
  v_duration    int;
  v_holidays    text[];
  v_from        date;
  v_to          date;
begin
  -- Hora local de Colombia. Nunca current_date a secas: el servidor está
  -- en UTC y después de las 19:00 COT daría el día siguiente.
  v_now   := (now() at time zone 'America/Bogota');
  v_today := v_now::date;

  select coalesce(trial_min_lead_hours, 24),
         coalesce(trial_horizon_days, 21),
         coalesce(trial_duration_minutes, 60),
         coalesce(holidays, '{}')
    into v_lead_hours, v_horizon, v_duration, v_holidays
    from public.settings
   limit 1;

  v_lead_hours := coalesce(v_lead_hours, 24);
  v_horizon    := coalesce(v_horizon, 21);
  v_duration   := coalesce(v_duration, 60);
  v_holidays   := coalesce(v_holidays, '{}');

  v_from := greatest(coalesce(p_from, v_today), v_today);
  v_to   := least(coalesce(p_to, v_today + v_horizon), v_today + v_horizon);

  return query
  with days as (
    select d::date as slot_date
      from generate_series(v_from, v_to, interval '1 day') d
  ),
  windows_on_day as (
    select d.slot_date, w.start_time, w.end_time, w.capacity,
           coalesce(w.slot_duration_minutes, v_duration) as dur
      from days d
      join public.trial_windows w
        on w.is_active
       and w.weekday = extract(dow from d.slot_date)::smallint
    union all
    -- Aperturas puntuales: se subdividen igual que las ventanas.
    select e.exception_date, e.start_time, e.end_time, 1::smallint, v_duration
      from public.trial_window_exceptions e
     where e.kind = 'open'
       and e.start_time is not null
       and e.end_time is not null
       and e.exception_date between v_from and v_to
  ),
  candidates as (
    -- Partir cada ventana en clases consecutivas.
    select w.slot_date,
           (w.start_time + make_interval(mins => n * w.dur))       as start_time,
           (w.start_time + make_interval(mins => (n + 1) * w.dur)) as end_time,
           w.capacity
      from windows_on_day w
      cross join lateral generate_series(
        0,
        greatest(
          floor(extract(epoch from (w.end_time - w.start_time)) / 60 / w.dur)::int - 1,
          -1
        )
      ) as n
  ),
  allowed as (
    select distinct c.slot_date, c.start_time, c.end_time, c.capacity
      from candidates c
     where
       -- Descartar los huecos que cruzan medianoche.
       c.end_time > c.start_time
       and (c.slot_date + c.start_time) >= (v_now + make_interval(hours => v_lead_hours))
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
         least(a.capacity - k.taken, f.free_count)::int as seats_left,
         a.capacity::int
    from allowed a
    cross join lateral (
      select count(*)::int as free_count
        from public.trial_free_teachers(a.slot_date, a.start_time, a.end_time)
    ) f
    cross join lateral (
      -- Reservas que ya ocupan esta clase, del agendador propio o de
      -- Calendly. Es lo que hace que capacity signifique algo.
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

-- Recrear la función restablece los permisos por defecto, así que hay que
-- volver a cerrarla a anon (ver 20260815000039).
revoke all on function public.get_trial_availability(date, date) from public;
revoke all on function public.get_trial_availability(date, date) from anon;
grant execute on function public.get_trial_availability(date, date) to authenticated;
grant execute on function public.get_trial_availability(date, date) to service_role;


create or replace function public.book_trial_slot(
  p_lead_id    uuid,
  p_date       date,
  p_start      time,
  p_source     text default 'public_self',
  p_course_id  uuid default null,
  p_teacher_id uuid default null,
  p_reason     text default null,
  p_actor      uuid default null,
  p_force      boolean default false,
  p_duration_minutes int default null
)
returns public.trial_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end      time;
  v_teacher  uuid;
  v_existing public.trial_bookings;
  v_booking  public.trial_bookings;
  v_ok       boolean;
  v_dur      int;
begin
  if p_lead_id is null or p_date is null or p_start is null then
    raise exception 'MISSING_ARGS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_date::text || p_start::text, 0));

  if p_force then
    select coalesce(p_duration_minutes, trial_duration_minutes, 60)
      into v_dur from public.settings limit 1;
    v_dur := coalesce(v_dur, 60);
    v_end := p_start + make_interval(mins => v_dur);
    -- El agendador no soporta clases que cruzan medianoche.
    if v_end <= p_start then
      raise exception 'CROSSES_MIDNIGHT';
    end if;
  else
    select true, a.end_time
      into v_ok, v_end
      from public.get_trial_availability(p_date, p_date) a
     where a.slot_date = p_date and a.start_time = p_start
     limit 1;

    if not coalesce(v_ok, false) then
      raise exception 'SLOT_UNAVAILABLE';
    end if;
  end if;

  -- En modo forzado el admin puede no indicar profesor: se elige uno libre
  -- si lo hay, y si no se deja sin asignar para que lo resuelva a mano.
  v_teacher := coalesce(
    p_teacher_id,
    public.pick_trial_teacher(p_date, p_start, v_end)
  );
  if v_teacher is null and not p_force then
    raise exception 'NO_TEACHER_AVAILABLE';
  end if;

  select * into v_existing
    from public.trial_bookings
   where lead_id = p_lead_id and status = 'booked'
   limit 1;

  if found then
    update public.trial_bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = coalesce(p_reason, 'Reagendada')
     where id = v_existing.id;

    insert into public.trial_reschedules
      (lead_id, previous_date, previous_time, new_date, new_time, reason, rescheduled_by)
    values
      (p_lead_id, v_existing.scheduled_date, v_existing.scheduled_start_time,
       p_date, p_start, p_reason, p_actor);
  end if;

  begin
    insert into public.trial_bookings
      (lead_id, teacher_id, scheduled_date, scheduled_start_time,
       scheduled_end_time, source, course_id)
    values
      (p_lead_id, v_teacher, p_date, p_start, v_end, p_source, p_course_id)
    returning * into v_booking;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return v_booking;
end $$;

revoke execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int) from anon;

