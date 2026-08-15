-- El link de autogestión del padre debe sobrevivir a una reagenda.
--
-- Reagendar cancela la reserva anterior y crea una nueva, que nacía con un
-- manage_token distinto. El padre tiene el link viejo en su correo, así que
-- al reagendar —justo cuando más va a usarlo— se le quedaba muerto. Ahora
-- la nueva reserva hereda el token de la anterior.
--
-- Eso obliga a cambiar el índice: era único global, y con dos filas
-- compartiendo token (la cancelada y la nueva) saltaba... y el handler lo
-- confundía con una colisión de hueco, devolviendo SLOT_TAKEN. La unicidad
-- sólo tiene sentido entre reservas activas.

drop index if exists public.ux_trial_bookings_manage_token;

create unique index ux_trial_bookings_manage_token
  on public.trial_bookings (manage_token)
  where status = 'booked';

-- Las consultas por token toman la fila más reciente, así que necesitan
-- un índice no único que las cubra.
create index if not exists ix_trial_bookings_manage_token_lookup
  on public.trial_bookings (manage_token);

-- book_trial_slot: hereda el token al reagendar. El resto del cuerpo es
-- idéntico al de 20260815000045.

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
  v_token    uuid;
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

    -- Heredar el token para no invalidar el link que el padre ya tiene.
    v_token := v_existing.manage_token;
  else
    v_token := gen_random_uuid();
  end if;

  begin
    insert into public.trial_bookings
      (lead_id, teacher_id, scheduled_date, scheduled_start_time,
       scheduled_end_time, source, course_id, manage_token)
    values
      (p_lead_id, v_teacher, p_date, p_start, v_end, p_source, p_course_id, v_token)
    returning * into v_booking;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return v_booking;
end $$;

revoke execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int) from anon;

