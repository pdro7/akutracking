/**
 * manage-trial — Autogestión del padre sobre su clase de prueba.
 *
 * Endpoint PÚBLICO (sin JWT), autorizado por manage_token: un uuid no
 * adivinable que sólo conoce quien reservó. Mismo patrón que
 * leads.form_token en /preferencias/:token.
 *
 * Acciones: read, cancel, reschedule.
 *
 * Devuelve lo justo para que el padre reconozca su cita: nombre del niño,
 * fecha y hora. Nunca el profesor asignado ni datos de otras reservas.
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

function friendlyError(raw: string): { message: string; status: number } {
  if (raw.includes('SLOT_TAKEN') || raw.includes('SLOT_UNAVAILABLE')) {
    return { message: 'Ese horario acaba de ocuparse. Elige otro, por favor.', status: 409 };
  }
  if (raw.includes('NO_TEACHER_AVAILABLE')) {
    return { message: 'Ese horario ya no está disponible. Elige otro, por favor.', status: 409 };
  }
  return { message: 'No pudimos completar el cambio. Inténtalo de nuevo.', status: 500 };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { action, token, date, start_time, reason } = await req.json();
    if (!token || !action) return json({ error: 'Enlace no válido' }, 400);

    // Puede haber varias filas con el mismo token si hubo reagendas (la
    // nueva hereda el token de la cancelada), así que se toma la más
    // reciente: es la que refleja el estado actual.
    const { data: rows } = await supabase
      .from('trial_bookings')
      .select('id, lead_id, scheduled_date, scheduled_start_time, scheduled_end_time, status, leads(child_name, parent_name)')
      .eq('manage_token', token)
      .order('created_at', { ascending: false })
      .limit(1);

    const booking = rows?.[0];
    if (!booking) return json({ error: 'No encontramos esa clase de prueba' }, 404);

    const lead = (booking as any).leads;
    const view = {
      child_name: lead?.child_name ?? '',
      parent_name: lead?.parent_name ?? '',
      date: booking.scheduled_date,
      start_time: String(booking.scheduled_start_time).slice(0, 5),
      end_time: String(booking.scheduled_end_time).slice(0, 5),
      status: booking.status,
    };

    // ── read ───────────────────────────────────────────────────────────
    if (action === 'read') {
      return json({ booking: view });
    }

    if (booking.status !== 'booked') {
      return json({ error: 'Esta clase ya no está activa', booking: view }, 409);
    }

    // Una clase que ya empezó no se toca desde aquí: que llamen.
    const nowCol = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }),
    );
    const startsAt = new Date(`${booking.scheduled_date}T${String(booking.scheduled_start_time).slice(0, 8)}`);
    if (startsAt <= nowCol) {
      return json({ error: 'Esta clase ya pasó. Escríbenos por WhatsApp.', booking: view }, 409);
    }

    // ── cancel ─────────────────────────────────────────────────────────
    if (action === 'cancel') {
      const { error } = await supabase.rpc('cancel_trial_booking', {
        p_booking_id: booking.id,
        p_reason: reason?.trim() || 'Cancelada por el padre',
      });
      if (error) {
        console.error('manage-trial cancel:', error.message);
        return json({ error: 'No pudimos cancelar. Inténtalo de nuevo.' }, 500);
      }

      await notify(booking.id, 'trial_cancelled');
      return json({ success: true, booking: { ...view, status: 'cancelled' } });
    }

    // ── reschedule ─────────────────────────────────────────────────────
    if (action === 'reschedule') {
      if (!date || !start_time) return json({ error: 'Elige un horario' }, 400);

      const { data: nb, error } = await supabase.rpc('book_trial_slot', {
        p_lead_id: booking.lead_id,
        p_date: date,
        p_start: start_time,
        p_source: 'public_self',
        p_reason: reason?.trim() || 'Reagendada por el padre',
        p_force: false,
      });

      if (error) {
        const { message, status } = friendlyError(error.message);
        console.error('manage-trial reschedule:', error.message);
        return json({ error: message }, status);
      }

      const b = Array.isArray(nb) ? nb[0] : nb;
      if (b?.id) await notify(b.id, 'trial_rescheduled');

      return json({
        success: true,
        booking: {
          ...view,
          date,
          start_time: String(start_time).slice(0, 5),
          end_time: String(b?.scheduled_end_time ?? '').slice(0, 5),
        },
      });
    }

    return json({ error: 'Acción no soportada' }, 400);
  } catch (err) {
    console.error('manage-trial error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

// Best-effort, igual que en book-trial: el cambio ya está hecho en la base,
// así que un fallo de correo no debe devolver error al padre.
async function notify(bookingId: string, kind: string): Promise<void> {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/trial-notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ booking_id: bookingId, kind }),
    });
  } catch (e) {
    console.error('manage-trial: fallo al notificar', e);
  }
}
