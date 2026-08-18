-- end_time de los grupos: relleno histórico y cálculo automático.
--
-- Ninguno de los 32 grupos tenía end_time (11 tenían start_time). Nunca se
-- rellenó a mano porque el formulario de creación sólo pide la hora de
-- inicio: la duración de una clase de grupo es siempre hora y media.
--
-- No es un detalle cosmético. v_teacher_busy exige "cg.end_time is not null"
-- para incluir una clase de grupo, así que con el campo vacío la rama de
-- grupos de la vista no devolvía NADA: la detección de solapes que añadió
-- 20260818000050 veía las clases individuales y las pruebas, pero un
-- profesor con grupo el sábado a las 09:00 figuraba libre a esa hora.
--
-- Los 90 minutos van fijos aquí porque es una regla del negocio, no un
-- parámetro que se toque: si algún día cambia, se cambia en este trigger.

-- ── Relleno de lo existente ──────────────────────────────────────────────
update public.course_groups
   set end_time = start_time + interval '90 minutes'
 where start_time is not null
   and end_time is null;

-- ── Cálculo automático de aquí en adelante ───────────────────────────────
-- Dos casos:
--   * end_time vacío -> se deriva de start_time.
--   * cambia start_time y el end_time anterior era el derivado -> se
--     recalcula, para que mover un grupo no deje el fin desfasado. Si
--     alguien puso un fin distinto a mano, se respeta.
create or replace function public.set_group_end_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.start_time is null then
    return new;
  end if;

  if new.end_time is null then
    new.end_time := new.start_time + interval '90 minutes';

  elsif tg_op = 'UPDATE'
        and old.start_time is distinct from new.start_time
        and old.end_time = old.start_time + interval '90 minutes'
        and new.end_time = old.end_time then
    new.end_time := new.start_time + interval '90 minutes';
  end if;

  return new;
end $$;

revoke all on function public.set_group_end_time() from public, anon, authenticated;

drop trigger if exists trg_group_end_time on public.course_groups;
create trigger trg_group_end_time
  before insert or update on public.course_groups
  for each row execute function public.set_group_end_time();
