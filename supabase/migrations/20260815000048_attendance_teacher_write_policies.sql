-- Permisos de escritura de asistencia para profesores.
--
-- attendance_records sólo tenía tres políticas: SELECT y INSERT para
-- authenticated, y ALL para admin. Faltaban UPDATE y DELETE para el resto
-- del equipo, así que un profesor no podía corregir una asistencia ya
-- guardada.
--
-- El fallo era silencioso y por eso confuso: RLS no lanza error cuando
-- bloquea un DELETE, simplemente afecta a 0 filas y devuelve éxito. El
-- guardado del modal de asistencia (VirtualGroupDetail) borra los registros
-- de la sesión y los vuelve a insertar; con el borrado neutralizado, el
-- INSERT chocaba contra la restricción única y el profesor veía
-- "duplicate key value violates unique constraint".
--
-- Se conceden a authenticated, igual que el INSERT que ya existía: quien
-- puede crear un registro de asistencia arbitrario debe poder corregirlo.
-- Todas las cuentas del sistema son personal de la escuela (admin o
-- teacher); no hay usuarios finales autenticados.

CREATE POLICY "Authenticated users can update attendance"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete attendance"
  ON public.attendance_records FOR DELETE TO authenticated
  USING (true);
