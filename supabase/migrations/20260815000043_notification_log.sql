-- Registro de notificaciones enviadas.
--
-- Sirve para dos cosas: saber qué se envió (y si falló) sin bucear en los
-- logs de la edge function, y garantizar idempotencia. El índice único
-- (booking_id, channel, kind) es lo que permite que el cron del
-- recordatorio corra cada hora sin enviar dos veces el mismo aviso.

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  booking_id uuid references public.trial_bookings(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  kind text not null check (kind in (
    'trial_confirmation','trial_reminder_24h','trial_rescheduled','trial_cancelled'
  )),
  recipient text,
  provider_id text,          -- id que devuelve Resend / Twilio
  error text,                -- si falló, por qué; la fila se escribe igual
  sent_at timestamptz not null default now()
);

-- Idempotencia: un aviso por reserva, canal y tipo. Los reenvíos tras un
-- fallo se hacen borrando la fila con error, no saltándose el índice.
create unique index ux_notification_log_once
  on public.notification_log (booking_id, channel, kind)
  where booking_id is not null and error is null;

create index ix_notification_log_lead on public.notification_log (lead_id, sent_at desc);

alter table public.notification_log enable row level security;

-- Solo lectura para el equipo: quien escribe es la edge function con
-- service role, no el navegador.
create policy "authenticated_read_notification_log"
  on public.notification_log for select to authenticated using (true);
