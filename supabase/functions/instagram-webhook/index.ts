/**
 * AKU Tracker — Instagram Webhook
 * ================================
 * Receives Instagram DM webhooks from Meta and stores them in
 * `instagram_conversations` for manual reply by staff.
 *
 * Two request types:
 *   GET  → Meta verification challenge (responds with hub.challenge)
 *   POST → DM event payload (signature-verified, appends to conversation)
 *
 * Environment variables (set in Supabase → Edge Functions → Secrets):
 *   INSTAGRAM_VERIFY_TOKEN  → arbitrary string we choose; must match Meta config
 *   INSTAGRAM_APP_SECRET    → Meta App Secret (for signature verification)
 *   SUPABASE_URL            → auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY → auto-injected
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-hub-signature-256',
}

// ── Signature verification (x-hub-signature-256: sha256=<hex>) ───────────────
async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader.startsWith('sha256=')) return false
  const expected = signatureHeader.slice('sha256='.length)

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === expected
}

serve(async (req) => {
  const url = new URL(req.url)

  // ── GET: Webhook verification ────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const verifyToken = Deno.env.get('INSTAGRAM_VERIFY_TOKEN') ?? ''

    if (mode === 'subscribe' && token && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── POST: Event payload ──────────────────────────────────────────────────
  try {
    const rawBody = await req.text()
    const sigHeader = req.headers.get('x-hub-signature-256') ?? ''
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET') ?? ''

    if (appSecret) {
      const valid = await verifySignature(rawBody, sigHeader, appSecret)
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const body = JSON.parse(rawBody)
    if (body.object !== 'instagram') {
      return new Response(JSON.stringify({ ok: true, note: 'not instagram event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    for (const entry of (body.entry ?? [])) {
      const igAccountId: string = entry.id
      for (const event of (entry.messaging ?? [])) {
        const senderId: string = event.sender?.id
        const recipientId: string = event.recipient?.id
        const message = event.message

        // Skip echoes (messages WE sent) and other non-text events
        if (!message || message.is_echo) continue
        // Skip events without a sender or a text/attachments
        if (!senderId) continue

        // The user is the one who is NOT our account
        const userId = senderId === igAccountId ? recipientId : senderId
        const text: string | null = message.text ?? null
        const attachments = message.attachments ?? null

        const newMsg = {
          role: 'user',
          content: text ?? '[Adjunto]',
          message_id: message.mid ?? null,
          attachments,
          timestamp: new Date((event.timestamp ?? Date.now())).toISOString(),
        }

        // Fetch existing conversation
        const { data: existing } = await supabase
          .from('instagram_conversations')
          .select('id, messages')
          .eq('instagram_user_id', userId)
          .maybeSingle()

        if (existing) {
          const messages = Array.isArray(existing.messages) ? existing.messages : []
          messages.push(newMsg)
          await supabase
            .from('instagram_conversations')
            .update({
              messages,
              unread: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('instagram_conversations').insert({
            instagram_user_id: userId,
            messages: [newMsg],
            unread: true,
            status: 'open',
          })
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('instagram-webhook error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
