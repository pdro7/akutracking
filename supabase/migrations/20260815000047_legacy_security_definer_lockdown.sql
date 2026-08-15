-- Cierre de las funciones SECURITY DEFINER heredadas.
--
-- Seis funciones antiguas eran ejecutables por anon vía /rest/v1/rpc/...
-- Al ser SECURITY DEFINER corren con los privilegios del propietario, así
-- que exponerlas a cualquiera con la clave pública es innecesario.
--
-- Misma trampa doble que en 20260815000039: Postgres concede EXECUTE a
-- PUBLIC al crear la función (anon lo hereda) y Supabase añade además una
-- concesión explícita a anon. Hacen falta los dos revokes.
--
-- Clasificación, que es lo que decide qué se puede revocar:
--
--   * Funciones de TRIGGER (handle_new_user, withdraw_on_archive,
--     reactivate_student_on_enroll, reactivate_student_on_individual_schedule):
--     las invoca el trigger, no quien hace el INSERT, así que nadie
--     necesita EXECUTE. Se revocan de todos.
--
--   * rls_auto_enable: es un EVENT TRIGGER (ensure_rls, ddl_command_end).
--     Igual que las anteriores: no se llama nunca directamente.
--
--   * has_role: es la excepción. Se usa DENTRO de políticas RLS de
--     students, settings, payments, attendance_records y user_roles, y
--     evaluar una política requiere que el rol que consulta tenga EXECUTE.
--     Por eso authenticated LA CONSERVA; si se revocara, el CRM entero
--     dejaría de poder leer esas tablas.
--     A anon sí se le quita: las páginas públicas no tocan esas tablas
--     (sólo virtual_courses, cuya política de anon no usa has_role) y todo
--     lo demás pasa por edge functions con service role.

-- ── Funciones de trigger ─────────────────────────────────────────────────
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.withdraw_on_archive() from public, anon, authenticated;
revoke all on function public.reactivate_student_on_enroll() from public, anon, authenticated;
revoke all on function public.reactivate_student_on_individual_schedule() from public, anon, authenticated;

-- ── Event trigger ────────────────────────────────────────────────────────
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- ── has_role: fuera de la API pública, dentro de las políticas ───────────
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
