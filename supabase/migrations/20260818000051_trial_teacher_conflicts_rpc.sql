-- Conflictos de un profesor para la prueba de un lead concreto.
--
-- El CRM necesita avisar en cuanto eliges profesor, antes de guardar. Podría
-- llamar a teacher_schedule_conflicts directamente, pero entonces el cliente
-- tendría que resolver por su cuenta fecha, hora y duración —que salen de la
-- reserva si existe y de settings si no—, duplicando lo que ya hace
-- set_trial_teacher y arriesgándose a que las dos versiones se separen.
create or replace function public.trial_teacher_conflicts(
  p_lead_id    uuid,
  p_teacher_id uuid
)
returns table (busy_kind text, busy_label text, busy_start time, busy_end time)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_booking public.trial_bookings;
  v_lead    public.leads;
  v_date    date;
  v_start   time;
  v_end     time;
  v_dur     int;
begin
  if p_lead_id is null or p_teacher_id is null then
    return;
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    return;
  end if;

  select * into v_booking
    from public.trial_bookings
   where lead_id = p_lead_id and status = 'booked'
   limit 1;

  if found then
    v_date := v_booking.scheduled_date;
    v_start := v_booking.scheduled_start_time;
    v_end := v_booking.scheduled_end_time;
  else
    v_date := v_lead.trial_class_date;
    v_start := v_lead.trial_class_time;
    if v_start is not null then
      select coalesce(trial_duration_minutes, 45) into v_dur from public.settings limit 1;
      v_end := v_start + make_interval(mins => coalesce(v_dur, 45));
    end if;
  end if;

  if v_date is null or v_start is null then
    return;
  end if;

  return query
    select c.busy_kind, c.busy_label, c.busy_start, c.busy_end
      from public.teacher_schedule_conflicts(p_teacher_id, v_date, v_start, v_end, p_lead_id) c;
end $$;

revoke all on function public.trial_teacher_conflicts(uuid, uuid) from public, anon;
grant execute on function public.trial_teacher_conflicts(uuid, uuid) to authenticated, service_role;
