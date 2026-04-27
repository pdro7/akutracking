/**
 * send-whatsapp — Manual reply endpoint for escalated conversations
 * Called from the CRM when an admin responds manually to a parent.
 *
 * Environment variables (auto-injected or set in Supabase → Secrets):
 *   SUPABASE_URL               → auto-injected
 *   SUPABASE_ANON_KEY          → auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  → auto-injected
 *   TWILIO_ACCOUNT_SID         → Twilio Account SID
 *   TWILIO_AUTH_TOKEN          → Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM       → e.g. "whatsapp:+14155238886"
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
    // Verify the caller is an authenticated CRM user
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

    // Use service role for DB writes
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { conversation_id, message } = await req.json();
    if (!conversation_id || !message?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing conversation_id or message' }), { status: 400, headers: CORS });
    }

    // Fetch conversation
    const { data: conv, error: fetchError } = await supabase
      .from('whatsapp_conversations')
      .select('phone, messages')
      .eq('id', conversation_id)
      .single();

    if (fetchError || !conv) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: CORS });
    }

    // Send via Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)');
    }

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: conv.phone,
          Body: message.trim(),
        }).toString(),
      },
    );

    if (!twilioRes.ok) {
      const err = await twilioRes.text();
      throw new Error(`Twilio error: ${err}`);
    }

    // Append to conversation history as an assistant message
    const updatedMessages = [
      ...(Array.isArray(conv.messages) ? conv.messages : []),
      { role: 'assistant', content: message.trim() },
    ];

    await supabase
      .from('whatsapp_conversations')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-whatsapp error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
