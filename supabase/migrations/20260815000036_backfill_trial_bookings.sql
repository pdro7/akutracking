-- Backfill: una reserva por cada prueba FUTURA que hoy vive sólo en leads.
--
-- Las pruebas pasadas no se migran: su histórico ya está en leads y en
-- trial_reschedules, y arrastrarlas sólo añadiría ruido y riesgo de
-- colisión en el índice único.
--
-- Al escribir la migración había 0 pruebas futuras, así que en la práctica
-- esto es un no-op. Se mantiene para cubrir cualquier reserva que entre
-- por Calendly entre ahora y el momento de aplicarla.

insert into public.trial_bookings
  (lead_id, teacher_id, scheduled_date, scheduled_start_time, scheduled_end_time,
   status, source, course_id)
select
  l.id,
  l.trial_teacher_id,
  l.trial_class_date,
  l.trial_class_time,
  l.trial_class_time + interval '90 minutes',
  'booked',
  case when l.calendly_uri is not null then 'calendly' else 'import' end,
  l.trial_course_id
from public.leads l
where l.trial_class_date is not null
  and l.trial_class_time is not null
  and l.status = 'trial_scheduled'
  and l.trial_class_date >= (now() at time zone 'America/Bogota')::date
on conflict do nothing;
