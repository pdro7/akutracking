/**
 * trial-notify — Correos de las clases de prueba.
 *
 * Endpoint INTERNO (verify_jwt = true): lo llaman book-trial y, más
 * adelante, el cron del recordatorio, siempre con la service role key.
 *
 * Es idempotente por diseño: antes de enviar mira notification_log, y el
 * índice único (booking_id, channel, kind) impide el duplicado incluso si
 * dos llamadas entran a la vez. Por eso el cron puede correr cada hora.
 *
 * Variables de entorno:
 *   RESEND_API_KEY  → API key de Resend
 *   RESEND_FROM     → p.ej. "AKUMAYA Educación <clases@akumaya.co>"
 *   PUBLIC_APP_URL  → base del sitio, para los links (opcional)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const WHATSAPP = '+57 316 294 1820';

type Kind = 'trial_confirmation' | 'trial_reminder_24h' | 'trial_rescheduled' | 'trial_cancelled';

// ── Fechas ────────────────────────────────────────────────────────────────
// Todo se guarda como hora local de Colombia en columnas date + time, así
// que aquí no se convierte nada: sólo se formatea.

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "2026-08-29" + "09:00" → "20260829T090000" */
function icsStamp(dateISO: string, time: string): string {
  return `${dateISO.replace(/-/g, '')}T${time.slice(0, 5).replace(':', '')}00`;
}

function buildIcs(opts: {
  uid: string; date: string; start: string; end: string; childName: string;
}): string {
  // Colombia no tiene horario de verano, así que un VTIMEZONE fijo a -05:00
  // es correcto todo el año.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AKUMAYA Educacion//Clase de prueba//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:America/Bogota',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0500',
    'TZNAME:-05',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@akumaya.co`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;TZID=America/Bogota:${icsStamp(opts.date, opts.start)}`,
    `DTEND;TZID=America/Bogota:${icsStamp(opts.date, opts.end)}`,
    'SUMMARY:Clase de prueba gratuita AKUMAYA',
    `DESCRIPTION:Clase de prueba virtual de programación para ${opts.childName}.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// ── Plantillas ────────────────────────────────────────────────────────────
// HTML inline y sencillo: los clientes de correo ignoran buena parte del
// CSS moderno, así que nada de flex ni variables.

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;">AKUMAYA Educación</p>
      <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;">${title}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:20px 28px 28px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:13px;color:#6b7280;">
        ¿Necesitas cambiar o cancelar la clase? Escríbenos por WhatsApp al
        <strong style="color:#1f2937;white-space:nowrap;">${WHATSAPP}</strong>.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function detailsBlock(dateLabel: string, start: string, end: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:8px;margin:0 0 16px;">
    <tr><td style="padding:14px 16px;font-size:15px;line-height:1.6;">
      <strong style="text-transform:capitalize;">${dateLabel}</strong><br>
      ${start} – ${end} (hora de Colombia)<br>
      <span style="color:#6b7280;">Clase virtual. Te enviamos el enlace de conexión antes de la clase.</span>
    </td></tr>
  </table>`;
}

function render(kind: Kind, d: {
  parentName: string; childName: string; dateLabel: string; start: string; end: string;
}): { subject: string; html: string } {
  const details = detailsBlock(d.dateLabel, d.start, d.end);

  if (kind === 'trial_confirmation') {
    return {
      subject: `Clase de prueba confirmada para ${d.childName}`,
      html: layout('¡Clase de prueba confirmada!', `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
          Hola ${d.parentName}, ya está reservada la clase de prueba de
          <strong>${d.childName}</strong>.
        </p>
        ${details}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
          Adjuntamos el evento para que lo añadas a tu calendario.
          Solo hace falta un computador con internet.
        </p>`),
    };
  }

  if (kind === 'trial_reminder_24h') {
    return {
      subject: `Mañana es la clase de prueba de ${d.childName}`,
      html: layout('Te esperamos mañana', `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
          Hola ${d.parentName}, un recordatorio de la clase de prueba de
          <strong>${d.childName}</strong>.
        </p>
        ${details}`),
    };
  }

  if (kind === 'trial_rescheduled') {
    return {
      subject: `Nueva fecha para la clase de prueba de ${d.childName}`,
      html: layout('Cambiamos la fecha de la clase', `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
          Hola ${d.parentName}, la clase de prueba de <strong>${d.childName}</strong>
          queda para:
        </p>
        ${details}`),
    };
  }

  return {
    subject: `Clase de prueba cancelada`,
    html: layout('Clase de prueba cancelada', `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Hola ${d.parentName}, hemos cancelado la clase de prueba de
        <strong>${d.childName}</strong> del ${d.dateLabel} a las ${d.start}.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;">
        Si quieres reprogramarla, escríbenos y buscamos otro hueco.
      </p>`),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { booking_id, kind } = await req.json() as { booking_id: string; kind: Kind };
    if (!booking_id || !kind) return json({ error: 'booking_id y kind son obligatorios' }, 400);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('RESEND_FROM');
    if (!apiKey || !from) {
      // Sin configurar todavía: no es un error del flujo de reserva.
      console.warn('trial-notify: falta RESEND_API_KEY o RESEND_FROM');
      return json({ skipped: true, reason: 'email_not_configured' });
    }

    const { data: booking, error: bErr } = await supabase
      .from('trial_bookings')
      .select('id, lead_id, scheduled_date, scheduled_start_time, scheduled_end_time, status, leads(parent_name, child_name, email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (bErr || !booking) return json({ error: 'Reserva no encontrada' }, 404);

    const lead = (booking as any).leads;
    const to = lead?.email?.trim();
    if (!to) return json({ skipped: true, reason: 'lead_sin_email' });

    // Idempotencia: si ya se envió, no repetir.
    const { data: already } = await supabase
      .from('notification_log')
      .select('id')
      .eq('booking_id', booking_id)
      .eq('channel', 'email')
      .eq('kind', kind)
      .is('error', null)
      .maybeSingle();
    if (already) return json({ skipped: true, reason: 'ya_enviado' });

    const date = booking.scheduled_date as string;
    const start = String(booking.scheduled_start_time).slice(0, 5);
    const end = String(booking.scheduled_end_time).slice(0, 5);

    const { subject, html } = render(kind, {
      parentName: (lead.parent_name ?? '').split(' ')[0] || 'hola',
      childName: lead.child_name ?? 'tu hijo(a)',
      dateLabel: prettyDate(date),
      start,
      end,
    });

    const payload: Record<string, unknown> = { from, to: [to], subject, html };

    // El .ics solo tiene sentido cuando la clase sigue en pie.
    if (kind === 'trial_confirmation' || kind === 'trial_rescheduled') {
      const ics = buildIcs({
        uid: booking_id, date, start, end,
        childName: lead.child_name ?? '',
      });
      payload.attachments = [{
        filename: 'clase-de-prueba.ics',
        content: btoa(unescape(encodeURIComponent(ics))),
      }];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    // La fila se escribe siempre, con o sin error: así se ve desde el CRM
    // qué pasó sin tener que abrir los logs.
    await supabase.from('notification_log').insert({
      lead_id: booking.lead_id,
      booking_id,
      channel: 'email',
      kind,
      recipient: to,
      provider_id: res.ok ? (body as any)?.id ?? null : null,
      error: res.ok ? null : JSON.stringify(body).slice(0, 500),
    });

    if (!res.ok) {
      console.error('trial-notify resend error:', body);
      return json({ error: 'No se pudo enviar el correo', detail: body }, 502);
    }

    return json({ sent: true, id: (body as any)?.id ?? null });
  } catch (err) {
    console.error('trial-notify error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
