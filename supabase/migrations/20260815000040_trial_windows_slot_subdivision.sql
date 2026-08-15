-- Las ventanas se subdividen en clases de duración fija.
--
-- Antes una ventana era UN hueco: 09:00–11:00 se ofrecía como una sola
-- clase de 2 h. Ahora una ventana es un RANGO de apertura que se parte en
-- clases consecutivas de slot_duration_minutes: 09:00–11:00 con clases de
-- 1 h ofrece 09:00 y 10:00.
--
-- capacity cambia de significado: pasa de "clases simultáneas en la
-- ventana" a "estudiantes por clase". Por defecto 1, porque las clases de
-- prueba son individuales; se puede subir por ventana si algún día se
-- quieren en grupo.
--
-- La reescritura de get_trial_availability que implementa la subdivisión
-- va en 20260815000041, que se aplicó junto con esta.

alter table public.trial_windows
  -- null = usar settings.trial_duration_minutes
  add column if not exists slot_duration_minutes int
    check (slot_duration_minutes is null or slot_duration_minutes > 0);

alter table public.trial_windows alter column capacity set default 1;

comment on column public.trial_windows.capacity is
  'Estudiantes admitidos por clase de prueba. 1 = individual.';
comment on column public.trial_windows.slot_duration_minutes is
  'Duración de cada clase dentro de la ventana. Null = settings.trial_duration_minutes.';

-- Duración por defecto de una clase de prueba: 1 hora.
update public.settings set trial_duration_minutes = 60;

-- Las clases de prueba son individuales.
update public.trial_windows set capacity = 1 where capacity <> 1;

-- Reservas creadas cuando una ventana era un único hueco: ocupaban todo el
-- rango y bloqueaban al profesor de más. Se ajustan a la duración real.
update public.trial_bookings
   set scheduled_end_time = scheduled_start_time + interval '60 minutes'
 where status = 'booked'
   and scheduled_end_time - scheduled_start_time > interval '60 minutes';
