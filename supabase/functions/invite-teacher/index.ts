import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Solo los administradores pueden invitar profesores' }), { status: 403, headers: corsHeaders });
    }

    const { email, teacher_id, redirect_to } = await req.json();
    if (!email || !teacher_id) {
      return new Response(JSON.stringify({ error: 'email y teacher_id son requeridos' }), { status: 400, headers: corsHeaders });
    }

    const redirectTo = redirect_to || undefined;

    // Look up the current teacher row. If it already has a linked auth
    // user (from a prior invitation — possibly to a wrong email that was
    // later corrected on the teachers.email column), clean it up before
    // sending a fresh invitation. Without this cleanup:
    //  a) the wrong user account still exists and can log in;
    //  b) inviteUserByEmail to the new address might succeed but the
    //     teacher row stays pointing at the wrong user_id.
    const { data: teacherRow } = await supabaseAdmin
      .from('teachers')
      .select('user_id')
      .eq('id', teacher_id)
      .maybeSingle();

    const previousUserId = teacherRow?.user_id as string | null | undefined;
    if (previousUserId) {
      // Best-effort cleanup: remove the role row (if any) and delete the
      // previous auth user. Fails are tolerated — we still want to invite.
      await supabaseAdmin.from('user_roles').delete().eq('user_id', previousUserId);
      try {
        await supabaseAdmin.auth.admin.deleteUser(previousUserId);
      } catch (_) {
        // ignore — user may already be gone
      }
      await supabaseAdmin.from('teachers').update({ user_id: null }).eq('id', teacher_id);
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: corsHeaders });
    }

    const newUserId = inviteData.user.id;

    await supabaseAdmin.from('user_roles').upsert(
      { user_id: newUserId, role: 'teacher' },
      { onConflict: 'user_id' },
    );

    await supabaseAdmin.from('teachers').update({ user_id: newUserId }).eq('id', teacher_id);

    return new Response(
      JSON.stringify({ success: true, reinvited: !!previousUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
