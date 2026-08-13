import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Public endpoint for the /interes form. Anyone can call it — that's the
// point. It dedupes by phone so parents who already contacted us via
// WhatsApp and got manually added don't create duplicates when they fill
// the form later.

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '');
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
      child_name,
      parent_name,
      phone,
      email,
      date_of_birth,
      interested_course_id,
      preferred_slots,
      preferred_modality,
      desired_start_by,
      notes,
      referral_code,
    } = body ?? {};

    if (!child_name?.trim() || !parent_name?.trim() || !phone?.trim()) {
      return new Response(JSON.stringify({ error: 'Nombre del niño, del padre y teléfono son obligatorios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const trimmedPhone = phone.trim();
    const digits = normalizePhone(trimmedPhone);

    // Resolve referral code (if any) to a student id. Silent failure —
    // an invalid or expired code just means no attribution.
    let referredByStudentId: string | null = null;
    if (typeof referral_code === 'string' && referral_code.trim()) {
      const { data: ref } = await supabaseAdmin
        .from('referral_codes')
        .select('student_id, is_active, students!inner(phone, archived)')
        .eq('code', referral_code.trim().toUpperCase())
        .maybeSingle();
      if (ref && ref.is_active && !(ref as any).students?.archived) {
        // Guard against self-referral: don't credit if the referrer's own
        // phone matches the new lead's phone.
        const referrerPhone = normalizePhone((ref as any).students?.phone ?? '');
        if (referrerPhone !== digits) {
          referredByStudentId = (ref as any).student_id;
        }
      }
    }

    // Look for an existing lead by phone (either exact or by digits only).
    const { data: candidates } = await supabaseAdmin
      .from('leads')
      .select('id, form_token, child_name, parent_name, email, date_of_birth, interested_course_id, preferred_slots, preferred_modality, desired_start_by, phone, referred_by_student_id')
      .or(`phone.eq.${trimmedPhone},phone.eq.+${digits},phone.eq.${digits}`);

    const existing = (candidates ?? []).find((l: any) => normalizePhone(l.phone || '') === digits) || null;

    const payload: Record<string, unknown> = {
      child_name: child_name.trim(),
      parent_name: parent_name.trim(),
      phone: trimmedPhone,
      email: email?.trim() || null,
      date_of_birth: date_of_birth || null,
      interested_course_id: interested_course_id || null,
      preferred_slots: Array.isArray(preferred_slots) ? preferred_slots : [],
      preferred_modality: preferred_modality || null,
      desired_start_by: desired_start_by || null,
      notes: notes?.trim() || null,
    };

    if (existing) {
      // Update, but never overwrite already-filled name / email / dob fields.
      const patch: Record<string, unknown> = { ...payload };
      if (existing.child_name) patch.child_name = existing.child_name;
      if (existing.parent_name) patch.parent_name = existing.parent_name;
      if (existing.email) patch.email = existing.email;
      if (existing.date_of_birth) patch.date_of_birth = existing.date_of_birth;
      // Attribute the referral only if the lead didn't already carry one —
      // first click wins, no re-attribution of existing pipeline leads.
      if (referredByStudentId && !(existing as any).referred_by_student_id) {
        patch.referred_by_student_id = referredByStudentId;
      }
      patch.updated_at = new Date().toISOString();

      const { error: updErr } = await supabaseAdmin.from('leads').update(patch).eq('id', existing.id);
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, mode: 'updated', lead_id: existing.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const insertPayload: Record<string, unknown> = { ...payload, source: 'web', status: 'new' };
    if (referredByStudentId) insertPayload.referred_by_student_id = referredByStudentId;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('leads')
      .insert(insertPayload)
      .select('id')
      .single();
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, mode: 'created', lead_id: inserted.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
