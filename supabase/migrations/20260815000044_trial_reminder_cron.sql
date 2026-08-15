-- Recordatorio automático 24 h antes de la clase de prueba.
--
-- pg_cron dispara cada hora una función que busca las clases que empiezan
-- dentro de las próximas 24 h y llama a trial-notify por cada una.
--
-- La ventana es "todo lo que empieza en las próximas 24 h", no una franja
-- exacta, y la idempotencia la garantiza el índice único de
-- notification_log. Así el sistema se autorrepara: si una ejecución falla
-- o el servidor estuvo caído una hora, el siguiente tick lo recoge y sigue
-- enviando exactamente un recordatorio por reserva.
--
-- Como la antelación mínima para reservar son 24 h, ninguna reserva nace
-- ya dentro de la ventana: siempre da tiempo a avisar.
--
-- REQUIERE que la service role key esté guardada en Vault:
--   select vault.create_secret('<clave>', 'service_role_key');
-- Sin ella la función no envía nada y deja un notice.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.send_trial_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamp;
  v_key   text;
  v_url   text := 'https://kmjordmkybqvihcgosct.supabase.co/functions/v1/trial-notify';
  v_count int := 0;
  r       record;
begin
  -- Hora local de Colombia. Nunca now() a secas: el servidor está en UTC.
  v_now := (now() at time zone 'America/Bogota');

  -- La service role key vive en Vault, no en el cuerpo del cron: si
  -- estuviera en cron.job la vería cualquiera con acceso de lectura.
  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'service_role_key'
   limit 1;

  if v_key is null then
    raise notice 'send_trial_reminders: falta el secreto service_role_key en Vault';
    return 0;
  end if;

  for r in
    select b.id
      from public.trial_bookings b
      join public.leads l on l.id = b.lead_id
     where b.status = 'booked'
       and l.email is not null
       and (b.scheduled_date + b.scheduled_start_time) > v_now
       and (b.scheduled_date + b.scheduled_start_time) <= v_now + interval '24 hours'
       and not exists (
         select 1 from public.notification_log n
          where n.booking_id = b.id
            and n.channel = 'email'
            and n.kind = 'trial_reminder_24h'
            and n.error is null
       )
  loop
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object(
                   'booking_id', r.id,
                   'kind', 'trial_reminder_24h'
                 )
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Nadie la invoca por RPC: la dispara el cron.
revoke all on function public.send_trial_reminders() from public;
revoke all on function public.send_trial_reminders() from anon;
revoke all on function public.send_trial_reminders() from authenticated;

-- Cada hora en punto.
select cron.schedule(
  'trial-reminders-hourly',
  '0 * * * *',
  $$ select public.send_trial_reminders(); $$
);
