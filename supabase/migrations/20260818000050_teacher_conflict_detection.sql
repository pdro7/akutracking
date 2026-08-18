-- Detección de solapes al asignar profesor a una clase de prueba.
--
-- Caso que lo motiva: una prueba manual quedó a nombre de un profesor que a
-- la hora siguiente ya tenía una clase individual. Nada avisó.
--
-- Dos agujeros distintos:
--
--   1. book_trial_slot con p_force no comprueba la agenda del profesor. La
--      única red era ux_trial_bookings_slot, que sólo pilla otra PRUEBA con
--      la misma hora de inicio exacta: una prueba de 10:30 contra una clase
--      de 11:00 pasaba limpia.
--
--   2. El selector de profesor de TrialLeadDetail escribía
--      leads.trial_teacher_id sin tocar trial_bookings.teacher_id. Como
--      v_teacher_busy lee de trial_bookings, la prueba ocupaba la agenda del
--      profesor equivocado y el asignado seguía figurando libre. 33 y su
--      comentario "no hay trigger inverso a propósito" daban por hecho que
--      todas las escrituras de trial pasaban por el RPC; el profesor era la
--      excepción que se coló.
--
-- La dirección de sincronización se mantiene como estaba (bookings -> leads,
-- vía sync_lead_from_trial_booking). Lo que cambia es que asignar profesor
-- ahora escribe en la reserva, no en el lead, y el trigger existente lo
-- refleja de vuelta.

-- ── 1. La vista gana etiqueta y origen ───────────────────────────────────
-- Se añaden columnas AL FINAL: "create or replace view" no permite otra
-- cosa. Los consumidores actuales (trial_free_teachers, get_trial_availability)
-- hacen select 1 / count(*), así que no les afecta.
--
-- busy_lead_id permite excluir la propia prueba al recalcular: sin él,
-- reasignar el profesor de una reserva chocaría consigo misma.
create or replace view public.v_teacher_busy as
  select cg.teacher_id,
         cs.scheduled_date as busy_date,
         cg.start_time     as busy_start,
         cg.end_time       as busy_end,
         'group'::text     as busy_kind,
         coalesce('Clase de grupo ' || cg.code, 'Clase de grupo') as busy_label,
         null::uuid        as busy_lead_id
    from public.course_sessions cs
    join public.course_groups cg on cg.id = cs.group_id
   where coalesce(cs.status, '') <> 'cancelled'
     and cg.teacher_id is not null
     and cg.start_time is not null
     and cg.end_time is not null

  union all

  select i.teacher_id,
         i.scheduled_date,
         i.scheduled_start_time,
         coalesce(i.scheduled_end_time, i.scheduled_start_time + interval '60 minutes'),
         'individual'::text,
         coalesce('Clase individual con ' || btrim(s.name), 'Clase individual'),
         null::uuid
    from public.individual_sessions i
    left join public.students s on s.id = i.student_id
   where i.status = 'scheduled'
     and i.teacher_id is not null

  union all

  select b.teacher_id, b.scheduled_date, b.scheduled_start_time, b.scheduled_end_time,
         'trial'::text,
         coalesce('Clase de prueba de ' || btrim(l.child_name), 'Clase de prueba'),
         b.lead_id
    from public.trial_bookings b
    left join public.leads l on l.id = b.lead_id
   where b.status = 'booked'
     and b.teacher_id is not null

  union all

  select l.trial_teacher_id,
         l.trial_class_date,
         l.trial_class_time,
         l.trial_class_time + interval '90 minutes',
         'trial_legacy'::text,
         coalesce('Clase de prueba de ' || btrim(l.child_name) || ' (Calendly)', 'Clase de prueba (Calendly)'),
         l.id
    from public.leads l
   where l.trial_class_date is not null
     and l.trial_class_time is not null
     and l.trial_teacher_id is not null
     and l.status = 'trial_scheduled'
     and not exists (
       select 1 from public.trial_bookings b
        where b.lead_id = l.id and b.status = 'booked'
     );

-- ── 2. Consulta de solapes ───────────────────────────────────────────────
-- La usa el CRM para avisar ANTES de guardar, y book_trial_slot para
-- decidir si hay que frenar. Devuelve filas para poder decir qué choca y a
-- qué hora, no un booleano.
create or replace function public.teacher_schedule_conflicts(
  p_teacher_id uuid,
  p_date       date,
  p_start      time,
  p_end        time,
  p_exclude_lead_id uuid default null
)
returns table (busy_kind text, busy_label text, busy_start time, busy_end time)
language sql
stable
security definer
set search_path = public
as $$
  select b.busy_kind, b.busy_label, b.busy_start, b.busy_end
    from public.v_teacher_busy b
   where p_teacher_id is not null
     and b.teacher_id = p_teacher_id
     and b.busy_date  = p_date
     and (b.busy_start, b.busy_end) overlaps (p_start, p_end)
     and (p_exclude_lead_id is null or b.busy_lead_id is distinct from p_exclude_lead_id)
   order by b.busy_start;
$$;

revoke all on function public.teacher_schedule_conflicts(uuid, date, time, time, uuid) from public, anon;
grant execute on function public.teacher_schedule_conflicts(uuid, date, time, time, uuid) to authenticated, service_role;

-- ── 3. book_trial_slot comprueba la agenda ───────────────────────────────
-- Mismo aviso que en 38: añadir un argumento crea una SOBRECARGA. La firma
-- de 10 se elimina al final para que ninguna llamada quede ambigua.
--
-- p_allow_conflict es deliberadamente distinto de p_force: forzar la hora
-- (un padre que pide algo fuera de horario) no debería implicar aceptar en
-- silencio que el profesor ya está dando otra clase.
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
  p_duration_minutes int default null,
  p_allow_conflict boolean default false
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
  v_conflict text;
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

  v_teacher := coalesce(
    p_teacher_id,
    public.pick_trial_teacher(p_date, p_start, v_end)
  );
  if v_teacher is null and not p_force then
    raise exception 'NO_TEACHER_AVAILABLE';
  end if;

  -- Se excluye la propia prueba: reagendar no puede chocar consigo misma.
  if v_teacher is not null and not p_allow_conflict then
    select c.busy_label || ' (' || to_char(c.busy_start, 'HH24:MI') ||
           '–' || to_char(c.busy_end, 'HH24:MI') || ')'
      into v_conflict
      from public.teacher_schedule_conflicts(v_teacher, p_date, p_start, v_end, p_lead_id) c
     limit 1;

    if v_conflict is not null then
      raise exception 'TEACHER_CONFLICT: %', v_conflict;
    end if;
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

revoke execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int, boolean) from anon, public;
grant execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int, boolean) to authenticated, service_role;

drop function if exists public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int);

-- ── 4. Asignar profesor escribe en la reserva ────────────────────────────
-- Cierra el agujero 2. Si el lead tiene reserva activa se actualiza ahí y el
-- trigger sync_lead_from_trial_booking lo refleja en el lead; si no la tiene
-- (pruebas heredadas de Calendly) se escribe en el lead, que es su única
-- representación.
create or replace function public.set_trial_teacher(
  p_lead_id        uuid,
  p_teacher_id     uuid,
  p_allow_conflict boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking  public.trial_bookings;
  v_lead     public.leads;
  v_end      time;
  v_dur      int;
  v_conflict text;
  v_date     date;
  v_start    time;
begin
  if p_lead_id is null then
    raise exception 'MISSING_ARGS';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  select * into v_booking
    from public.trial_bookings
   where lead_id = p_lead_id and status = 'booked'
   limit 1;

  if found then
    v_date  := v_booking.scheduled_date;
    v_start := v_booking.scheduled_start_time;
    v_end   := v_booking.scheduled_end_time;
  else
    v_date  := v_lead.trial_class_date;
    v_start := v_lead.trial_class_time;
    if v_start is not null then
      select coalesce(trial_duration_minutes, 45) into v_dur from public.settings limit 1;
      v_end := v_start + make_interval(mins => coalesce(v_dur, 45));
    end if;
  end if;

  -- Sin fecha/hora no hay nada contra lo que comprobar: es un lead al que
  -- se le pre-asigna profesor antes de agendar.
  if p_teacher_id is not null and v_date is not null and v_start is not null
     and not p_allow_conflict then
    select c.busy_label || ' (' || to_char(c.busy_start, 'HH24:MI') ||
           '–' || to_char(c.busy_end, 'HH24:MI') || ')'
      into v_conflict
      from public.teacher_schedule_conflicts(p_teacher_id, v_date, v_start, v_end, p_lead_id) c
     limit 1;

    if v_conflict is not null then
      raise exception 'TEACHER_CONFLICT: %', v_conflict;
    end if;
  end if;

  if v_booking.id is not null then
    update public.trial_bookings
       set teacher_id = p_teacher_id
     where id = v_booking.id;
  else
    update public.leads
       set trial_teacher_id = p_teacher_id,
           updated_at = now()
     where id = p_lead_id;
  end if;
end $$;

revoke all on function public.set_trial_teacher(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_trial_teacher(uuid, uuid, boolean) to authenticated, service_role;

-- ── 5. Realinear lo que ya divergió ──────────────────────────────────────
-- Reservas cuyo profesor no coincide con el del lead. El lead manda porque
-- es lo que el admin vio y decidió en el CRM; la reserva tenía el que eligió
-- pick_trial_teacher automáticamente.
update public.trial_bookings b
   set teacher_id = l.trial_teacher_id
  from public.leads l
 where l.id = b.lead_id
   and b.status = 'booked'
   and l.trial_teacher_id is not null
   and b.teacher_id is distinct from l.trial_teacher_id;
