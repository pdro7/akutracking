-- Modo forzado para el admin.
--
-- El RPC revalida el hueco contra las ventanas configuradas, que es lo
-- correcto para el link público. Pero el admin tiene que poder colocar una
-- prueba a una hora arbitraria (un padre que pide algo fuera de horario,
-- un caso excepcional). Sin esto, conectar TrialLeadDetail al RPC quitaría
-- una capacidad que hoy existe.
--
-- p_force salta la comprobación de disponibilidad y permite fijar la
-- duración, pero NO salta el índice único: sigue sin poderse pisar a un
-- profesor que ya tenga otra prueba a esa hora.
--
-- OJO: "create or replace" con distinto número de argumentos crea una
-- SOBRECARGA, no un reemplazo. La firma antigua de 8 argumentos se elimina
-- al final, porque con las dos vivas cualquier llamada que use valores por
-- defecto sería ambigua.

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
    select coalesce(p_duration_minutes, trial_duration_minutes, 45)
      into v_dur from public.settings limit 1;
    v_end := p_start + make_interval(mins => coalesce(v_dur, 45));
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

drop function if exists public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid);
