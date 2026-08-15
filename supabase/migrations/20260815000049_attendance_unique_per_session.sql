-- Sustituye unique (student_id, date) por una unicidad compatible con el
-- modelo actual de sesiones.
--
-- La restricción venía del esquema original (20251019162551), de cuando un
-- alumno tenía como mucho una clase al día. Después llegaron
-- course_session_id (M11) y is_makeup, pero la unicidad nunca se relajó,
-- así que hoy un alumno no puede tener asistencia en dos sesiones el mismo
-- día: ni una clase regular más una recuperación, ni dos grupos distintos.
--
-- El reemplazo son dos índices únicos parciales que cubren los dos tipos de
-- registro que existen:
--
--   * Con sesión: uno por (alumno, sesión). Es lo que de verdad hay que
--     impedir duplicar, y permite varias sesiones el mismo día. Va como
--     CONSTRAINT y no como índice parcial a propósito: los registros sin
--     sesión no colisionan igualmente (NULL es distinto de NULL en un
--     índice único), y una restricción sin predicado es la única forma de
--     que PostgREST pueda usarla como destino de un upsert.
--
--   * Sin sesión y sin recuperación: los registros sueltos que se crean a
--     mano desde la ficha del alumno (StudentDetail). Ahí sí se conserva la
--     regla de uno por día, que es lo que esa pantalla asume.
--
--   * Las recuperaciones (is_makeup) quedan fuera de ambos índices a
--     propósito: por definición se añaden sobre un día que ya puede tener
--     clase.
--
-- Verificado antes de aplicar: 58 registros, 0 colisiones con las nuevas
-- reglas.

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_student_id_date_key;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_student_session_uniq
  UNIQUE (student_id, course_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_date_standalone_uniq
  ON public.attendance_records (student_id, date)
  WHERE course_session_id IS NULL AND is_makeup = false;
