-- Fix de seguridad del agendador. Tres agujeros, misma raíz: en Postgres
-- (y más aún en Supabase) conceder acceso es el estado por defecto, y
-- revocar del rol equivocado no quita nada.
--
-- 1. Postgres concede EXECUTE a PUBLIC al crear una función. Un
--    "revoke ... from anon" NO lo elimina: anon lo hereda de PUBLIC. Como
--    todas son SECURITY DEFINER, cualquiera con la anon key (embebida en
--    el frontend) podía reservar o cancelar clases de prueba saltándose la
--    edge function.
--
-- 2. Supabase además concede EXECUTE a anon de forma EXPLÍCITA sobre las
--    funciones nuevas de public, vía default privileges. Eso tampoco lo
--    quita un revoke sobre PUBLIC: hace falta revocar de anon.
--
-- 3. v_teacher_busy es una VISTA: no tiene RLS propia y por defecto se
--    ejecuta con los permisos del propietario, saltándose la RLS de las
--    tablas de debajo. Con el SELECT que anon recibe por defecto, exponía
--    la agenda completa de los profesores.
--
-- Las tablas trial_* no estaban afectadas: tienen RLS activa y sólo
-- políticas para authenticated, así que anon no ve ninguna fila.

-- ── 1. Quitar la concesión heredada de PUBLIC ─────────────────────────────
revoke all on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int) from public;
revoke all on function public.cancel_trial_booking(uuid, text) from public;
revoke all on function public.get_trial_availability(date, date) from public;
revoke all on function public.pick_trial_teacher(date, time, time) from public;
revoke all on function public.trial_free_teachers(date, time, time) from public;
revoke all on function public.sync_lead_from_trial_booking() from public;

-- ── 2. Quitar la concesión explícita a anon ───────────────────────────────
revoke execute on function public.trial_free_teachers(date, time, time) from anon;
revoke execute on function public.pick_trial_teacher(date, time, time) from anon;
revoke execute on function public.sync_lead_from_trial_booking() from anon;

-- ── Conceder a quien sí debe ──────────────────────────────────────────────
-- authenticated: el admin opera desde el CRM.
grant execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int) to authenticated;
grant execute on function public.cancel_trial_booking(uuid, text) to authenticated;
grant execute on function public.get_trial_availability(date, date) to authenticated;
grant execute on function public.trial_free_teachers(date, time, time) to authenticated;
grant execute on function public.pick_trial_teacher(date, time, time) to authenticated;

-- service_role: el link público entra por edge function, nunca directo.
grant execute on function public.book_trial_slot(uuid, date, time, text, uuid, uuid, text, uuid, boolean, int) to service_role;
grant execute on function public.cancel_trial_booking(uuid, text) to service_role;
grant execute on function public.get_trial_availability(date, date) to service_role;
grant execute on function public.trial_free_teachers(date, time, time) to service_role;
grant execute on function public.pick_trial_teacher(date, time, time) to service_role;

-- ── 3. La vista ───────────────────────────────────────────────────────────
alter view public.v_teacher_busy set (security_invoker = true);
revoke all on public.v_teacher_busy from anon;
revoke all on public.v_teacher_busy from public;
grant select on public.v_teacher_busy to authenticated;
grant select on public.v_teacher_busy to service_role;

-- ── Detalles señalados por el linter de Supabase ──────────────────────────
-- search_path mutable: sin fijarlo, un rol podría anteponer un esquema
-- propio y secuestrar lo que resuelve la función.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end $$;

-- Funciones de trigger: se ejecutan desde el trigger con los permisos del
-- propietario. Nadie necesita poder invocarlas por RPC.
revoke all on function public.sync_lead_from_trial_booking() from authenticated;
revoke all on function public.touch_updated_at() from public;
revoke all on function public.touch_updated_at() from anon;
revoke all on function public.touch_updated_at() from authenticated;
