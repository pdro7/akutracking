/**
 * AKU Tracker — Calendly Webhook Handler
 * =======================================
 * Receives Calendly v2 webhooks and upserts trial leads in Supabase.
 *
 * Events handled:
 *   invitee.created  → INSERT trial lead (status = 'scheduled')
 *   invitee.canceled → UPDATE status = 'cancelled'
 *
 * Environment variables (set in Supabase → Edge Functions → Secrets):
 *   CALENDLY_SIGNING_KEY   → Webhook signing key from Calendly dashboard
 *   SUPABASE_URL           → auto-injected by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY → auto-injected by Supabase runtime
 *
 * Custom questions expected (in this order in your Calendly form):
 *   1. Celular
 *   2. Nombre de tu hijo(a)
 *   3. Edad de tu hijo(a)
 *   4. Ciudad
 *   5. ¿Ha tenido experiencia previa con programación?
 *   6. ¿Cómo nos conociste?
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
}

// ── Signature verification ────────────────────────────────────────────────────
async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  signingKey: string,
): Promise<boolean> {
  // Format: "t=<unix_timestamp>,v1=<hex_hmac>"
  const tMatch = signatureHeader.match(/t=(\d+)/)
  const v1Match = signatureHeader.match(/v1=([a-f0-9]+)/)
  if (!tMatch || !v1Match) return false

  const timestamp = tMatch[1]
  const expected = v1Match[1]

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  )
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === expected
}

// ── Helper: find answer by matching a substring of the question ───────────────
function getAnswer(
  qas: Array<{ question: string; answer: string }>,
  keyword: string,
): string {
  const match = qas.find((qa) =>
    qa.question.toLowerCase().includes(keyword.toLowerCase()),
  )
  return match?.answer?.trim() ?? ''
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    const sigHeader = req.headers.get('calendly-webhook-signature') ?? ''
    const signingKey = Deno.env.get('CALENDLY_SIGNING_KEY') ?? ''

    // Verify signature when key is configured
    if (signingKey) {
      const valid = await verifySignature(rawBody, sigHeader, signingKey)
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const body = JSON.parse(rawBody)
    const eventType: string = body.event // "invitee.created" | "invitee.canceled"
    const payload = body.payload

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── invitee.created ───────────────────────────────────────────────────────
    if (eventType === 'invitee.created') {
      const qas: Array<{ question: string; answer: string }> =
        payload.questions_and_answers ?? []

      // Map the 6 custom questions
      const phone =
        getAnswer(qas, 'celular') ||
        payload.text_reminder_number ||
        ''
      const childName =
        getAnswer(qas, 'hijo') || getAnswer(qas, 'niño') || ''
      const age = getAnswer(qas, 'edad')
      const city = getAnswer(qas, 'ciudad')
      const experience = getAnswer(qas, 'experiencia')
      const referral =
        getAnswer(qas, 'conociste') || getAnswer(qas, 'conocido')

      // Build notes from optional fields
      const noteParts: string[] = []
      if (age) noteParts.push(`Edad: ${age}`)
      if (city) noteParts.push(`Ciudad: ${city}`)
      if (experience) noteParts.push(`Exp. previa: ${experience}`)
      if (referral) noteParts.push(`Referido: ${referral}`)

      // Parse trial date from scheduled_event.start_time (ISO 8601)
      const startTime: string =
        payload.scheduled_event?.start_time ?? ''
      const trialDate = startTime
        ? startTime.split('T')[0]
        : new Date().toISOString().split('T')[0]

      const lead = {
        calendly_uri: payload.uri as string,
        parent_name: payload.name ?? '',
        parent_email: payload.email ?? '',
        parent_phone: phone,
        child_name: childName || '(por confirmar)',
        trial_class_date: trialDate,
        notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
        status: 'scheduled',
      }

      const { error } = await supabase
        .from('trial_leads')
        .upsert(lead, { onConflict: 'calendly_uri' })

      if (error) throw error

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── invitee.canceled ──────────────────────────────────────────────────────
    if (eventType === 'invitee.canceled') {
      const { error } = await supabase
        .from('trial_leads')
        .update({ status: 'cancelled' })
        .eq('calendly_uri', payload.uri)

      if (error) throw error

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Unknown event — acknowledge anyway
    return new Response(
      JSON.stringify({ ok: true, note: `event '${eventType}' ignored` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('calendly-webhook error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
