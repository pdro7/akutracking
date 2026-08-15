-- Reserva de clase de prueba, atómica.
--
-- Es el único camino de escritura de trials: lo usan la web pública, el
-- admin y (más adelante) Pablo y el webhook de Calendly. Reagendar es
-- llamar otra vez con otra fecha.

create or replace function public.book_trial_slot(
  p_lead_id    uuid,
  p_date       date,
  p_start      time,
  p_source     text default 'public_self',
  p_course_id  uuid default null,
  p_teacher_id uuid default null,   -- sólo el admin fuerza profesor
  p_reason     text default null,   -- motivo de reagenda
  p_actor      uuid default null    -- auth.users(id) que ejecuta, si aplica
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
begin
  if p_lead_id is null or p_date is null or p_start is null then
    raise exception 'MISSING_ARGS';
  end if;

  -- Serializa a dos padres pidiendo el mismo hueco. Se libera al terminar
  -- la transacción. El índice único ux_trial_bookings_slot sigue siendo la
  -- garantía dura por debajo.
  perform pg_advisory_xact_lock(hashtextextended(p_date::text || p_start::text, 0));

  -- Nunca confiar en el hueco que manda el cliente: revalidarlo aquí.
  select true, a.end_time
    into v_ok, v_end
    from public.get_trial_availability(p_date, p_date) a
   where a.slot_date = p_date and a.start_time = p_start
   limit 1;

  if not coalesce(v_ok, false) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  v_teacher := coalesce(
    p_teacher_id,
    public.pick_trial_teacher(p_date, p_start, v_end)
  );
  if v_teacher is null then
    raise exception 'NO_TEACHER_AVAILABLE';
  end if;

  -- Reagenda: cerrar la reserva anterior y dejar rastro en trial_reschedules.
  -- Esto es lo que hoy hace TrialLeadDetail en dos operaciones sin
  -- transacción; aquí va todo junto o no va.
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
    -- Alguien ganó la carrera pese al lock (o una escritura fuera del RPC).
    raise exception 'SLOT_TAKEN';
  end;

  return v_booking;
end $$;

-- ── Cancelar ──────────────────────────────────────────────────────────────
create or replace function public.cancel_trial_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.trial_bookings
language plpgsql
security definer
set search_path = public
as $$
declare v_booking public.trial_bookings;
begin
  update public.trial_bookings
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = p_booking_id and status = 'booked'
   returning * into v_booking;

  if not found then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  return v_booking;
end $$;

-- El público nunca llama a estas funciones directamente: entra por edge
-- function con service role. Se revoca el acceso de anon explícitamente.
revoke execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid) from anon;
revoke execute on function public.cancel_trial_booking(uuid, text) from anon;
revoke execute on function public.get_trial_availability(date, date) from anon;
