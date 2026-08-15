/**
 * trial-availability — Huecos libres para clases de prueba.
 *
 * Endpoint PÚBLICO (sin JWT): lo consume la página /agendar.
 *
 * Devuelve fecha, hora y cupos libres. Nunca el profesor asignado ni la
 * identidad de nadie: el padre no debe poder deducir quién está libre. El
 * profesor se resuelve al reservar.
 *
 * seats_left va acotado por la capacidad que fija el admin en la ventana,
 * así que no revela cuánta plantilla hay detrás.
 *
 * El rango se acota en la propia función SQL con settings.trial_horizon_days
 * y trial_min_lead_hours, así que un cliente no puede pedir dos años.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let from: string | null = null;
    let to: string | null = null;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      from = body?.from ?? null;
      to = body?.to ?? null;
    }

    const { data, error } = await supabaseAdmin.rpc('get_trial_availability', {
      p_from: from,
      p_to: to,
    });

    if (error) {
      console.error('trial-availability error:', error);
      return json({ error: 'No se pudo consultar la disponibilidad' }, 500);
    }

    const slots = (data ?? []).map((s: Record<string, unknown>) => ({
      date: s.slot_date,
      start_time: String(s.start_time ?? '').slice(0, 5),
      end_time: String(s.end_time ?? '').slice(0, 5),
      seats_left: Number(s.seats_left ?? 1),
    }));

    return json({ slots });
  } catch (err) {
    console.error('trial-availability error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
