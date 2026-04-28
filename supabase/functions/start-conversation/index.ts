/**
 * start-conversation — Sends a WhatsApp template to initiate a conversation with a lead.
 *
 * Environment variables:
 *   SUPABASE_URL               → auto-injected
 *   SUPABASE_ANON_KEY          → auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  → auto-injected
 *   TWILIO_ACCOUNT_SID         → Twilio Account SID
 *   TWILIO_AUTH_TOKEN          → Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM       → e.g. "whatsapp:+14155238886"
 *   TWILIO_TEMPLATE_SID        → Content SID of the approved template (HX...)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'Missing lead_id' }), { status: 400, headers: CORS });
    }

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, parent_name, phone, status')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404, headers: CORS });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
    const templateSid = Deno.env.get('TWILIO_TEMPLATE_SID');

    if (!accountSid || !authToken || !fromNumber || !templateSid) {
      throw new Error('Missing Twilio credentials or TWILIO_TEMPLATE_SID');
    }

    // Normalize phone to whatsapp: format
    // Colombian numbers stored without country code (e.g. "3001234567") need +57 prefix
    let rawPhone = lead.phone.replace(/\s+/g, '').replace(/^\+/, '');
    if (rawPhone.length === 10 && rawPhone.startsWith('3')) rawPhone = '57' + rawPhone;
    const toNumber = `whatsapp:+${rawPhone}`;

    // Ensure fromNumber has whatsapp: prefix regardless of how the secret was saved
    const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    // Send template via Twilio Content API
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: from,
          To: toNumber,
          ContentSid: templateSid,
          ContentVariables: JSON.stringify({ '1': lead.parent_name }),
        }).toString(),
      },
    );

    if (!twilioRes.ok) {
      const twilioErr = await twilioRes.json().catch(() => twilioRes.text());
      const msg = typeof twilioErr === 'object'
        ? (twilioErr.message ?? JSON.stringify(twilioErr))
        : String(twilioErr);
      return new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Build the template message text to store in history
    const templateText = `Hola ${lead.parent_name} 👋 Soy Pablo, asistente virtual de AKUMAYA Educación 🤖 Para poder darte información más detallada, cuéntame: ¿qué edad tiene tu hijo/a y en qué ciudad se encuentran? 😊`;

    // Create or update conversation record
    const { data: existing } = await supabase
      .from('whatsapp_conversations')
      .select('id, messages')
      .eq('phone', toNumber)
      .maybeSingle();

    if (existing) {
      const updatedMessages = [
        ...(Array.isArray(existing.messages) ? existing.messages : []),
        { role: 'assistant', content: templateText },
      ];
      await supabase
        .from('whatsapp_conversations')
        .update({ lead_id, messages: updatedMessages, escalated: false, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('whatsapp_conversations').insert({
        phone: toNumber,
        messages: [{ role: 'assistant', content: templateText }],
        lead_id,
        escalated: false,
      });
    }

    // Move lead to contacted if still new
    if (lead.status === 'new') {
      await supabase
        .from('leads')
        .update({ status: 'contacted', updated_at: new Date().toISOString() })
        .eq('id', lead_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('start-conversation error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
