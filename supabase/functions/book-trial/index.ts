/**
 * book-trial — Reserva de clase de prueba desde la página pública.
 *
 * Endpoint PÚBLICO (sin JWT). Sustituye al formulario de Calendly.
 *
 * Reutiliza el comportamiento de submit-interest: dedupe por teléfono,
 * sin pisar datos ya rellenos, y atribución de referido con guard contra
 * auto-referidos. La reserva en sí la hace el RPC book_trial_slot, que es
 * quien asigna profesor y garantiza que no haya dobles reservas.
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

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '');
}

// Los errores del RPC vienen como códigos; se traducen para el padre.
function friendlyError(raw: string): { message: string; status: number } {
  if (raw.includes('SLOT_TAKEN') || raw.includes('SLOT_UNAVAILABLE')) {
    return { message: 'Ese horario acaba de ocuparse. Elige otro, por favor.', status: 409 };
  }
  if (raw.includes('NO_TEACHER_AVAILABLE')) {
    return { message: 'Ese horario ya no está disponible. Elige otro, por favor.', status: 409 };
  }
  return { message: 'No pudimos completar la reserva. Inténtalo de nuevo.', status: 500 };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const {
      child_name, parent_name, phone, email, date_of_birth,
      date, start_time, interested_course_id, notes, referral_code,
      referral_source,
    } = body ?? {};

    if (!child_name?.trim() || !parent_name?.trim() || !phone?.trim()) {
      return json({ error: 'Nombre del niño, del padre y teléfono son obligatorios' }, 400);
    }
    // El correo es el único canal de confirmación y recordatorio, así que
    // aquí sí es obligatorio (en leads sigue siendo opcional para los que
    // entran por otras vías).
    if (!email?.trim()) {
      return json({ error: 'El correo es obligatorio para enviarte la confirmación' }, 400);
    }
    if (!date || !start_time) {
      return json({ error: 'Elige un horario' }, 400);
    }

    const trimmedPhone = phone.trim();
    const digits = normalizePhone(trimmedPhone);
    const newChild = child_name.trim().toLowerCase();

    // ── Rate limit: como máximo 3 reservas por teléfono en 24h ────────────
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recent } = await supabaseAdmin
      .from('trial_bookings')
      .select('id, leads!inner(phone)', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('leads.phone', trimmedPhone);
    if ((recent ?? 0) >= 3) {
      return json({ error: 'Has hecho demasiadas reservas hoy. Escríbenos por WhatsApp.' }, 429);
    }

    // ── Referido ─────────────────────────────────────────────────────────
    let referredByStudentId: string | null = null;
    if (typeof referral_code === 'string' && referral_code.trim()) {
      const { data: ref } = await supabaseAdmin
        .from('referral_codes')
        .select('student_id, is_active, students!inner(phone, archived)')
        .eq('code', referral_code.trim().toUpperCase())
        .maybeSingle();
      if (ref && (ref as any).is_active && !(ref as any).students?.archived) {
        const referrerPhone = normalizePhone((ref as any).students?.phone ?? '');
        if (referrerPhone !== digits) referredByStudentId = (ref as any).student_id;
      }
    }

    // ── Buscar lead existente ────────────────────────────────────────────
    // Igual que en el webhook de Calendly: un match por teléfono sólo vale
    // si el nombre del niño coincide, o si el lead existente era un stub.
    // Dos hermanos comparten teléfono y deben ser dos leads distintos.
    const { data: candidates } = await supabaseAdmin
      .from('leads')
      .select('id, phone, child_name, parent_name, email, date_of_birth, referred_by_student_id, referral_source')
      .or(`phone.eq.${trimmedPhone},phone.eq.+${digits},phone.eq.${digits}`);

    const existing = (candidates ?? []).find((l: any) => {
      if (normalizePhone(l.phone ?? '') !== digits) return false;
      const existingChild = (l.child_name ?? '').trim().toLowerCase();
      if (!existingChild || existingChild === '(por confirmar)') return true;
      return existingChild === newChild;
    }) ?? null;

    let leadId: string;

    if (existing) {
      const patch: Record<string, unknown> = {
        phone: trimmedPhone,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      // Nunca pisar datos ya rellenos.
      if (!existing.child_name || existing.child_name === '(por confirmar)') {
        patch.child_name = child_name.trim();
      }
      if (!existing.parent_name) patch.parent_name = parent_name.trim();
      if (!existing.email) patch.email = email.trim();
      if (!existing.date_of_birth && date_of_birth) patch.date_of_birth = date_of_birth;
      if (interested_course_id) patch.interested_course_id = interested_course_id;
      // El canal declarado no se pisa: vale el primero que lo dijo.
      if (referral_source && !existing.referral_source) {
        patch.referral_source = referral_source;
      }
      if (referredByStudentId && !existing.referred_by_student_id) {
        patch.referred_by_student_id = referredByStudentId;
      }

      const { error: updErr } = await supabaseAdmin.from('leads').update(patch).eq('id', existing.id);
      if (updErr) return json({ error: updErr.message }, 500);
      leadId = existing.id;
    } else {
      const insertPayload: Record<string, unknown> = {
        child_name: child_name.trim(),
        parent_name: parent_name.trim(),
        phone: trimmedPhone,
        email: email.trim(),
        date_of_birth: date_of_birth || null,
        interested_course_id: interested_course_id || null,
        referral_source: referral_source || null,
        notes: notes?.trim() || null,
        source: 'web',
        status: 'new',
      };
      if (referredByStudentId) insertPayload.referred_by_student_id = referredByStudentId;

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('leads').insert(insertPayload).select('id').single();
      if (insErr) return json({ error: insErr.message }, 500);
      leadId = inserted.id;
    }

    // ── Reservar ─────────────────────────────────────────────────────────
    const { data: booking, error: bookErr } = await supabaseAdmin.rpc('book_trial_slot', {
      p_lead_id: leadId,
      p_date: date,
      p_start: start_time,
      p_source: 'public_self',
      p_course_id: interested_course_id || null,
      p_force: false,
    });

    if (bookErr) {
      const { message, status } = friendlyError(bookErr.message);
      console.error('book-trial rpc error:', bookErr.message);
      return json({ error: message }, status);
    }

    const b = Array.isArray(booking) ? booking[0] : booking;

    // ── Confirmación por correo ──────────────────────────────────────────
    // Best-effort a propósito: la reserva ya está hecha y confirmada en
    // pantalla. Si el correo falla, se registra en notification_log y se
    // puede reenviar, pero no se tumba la reserva por eso.
    if (b?.id) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/trial-notify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ booking_id: b.id, kind: 'trial_confirmation' }),
        });
      } catch (e) {
        console.error('book-trial: fallo al disparar la confirmación', e);
      }
    }

    return json({
      success: true,
      lead_id: leadId,
      booking_id: b?.id ?? null,
      manage_token: b?.manage_token ?? null,
      date,
      start_time: String(start_time).slice(0, 5),
    });
  } catch (err) {
    console.error('book-trial error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
