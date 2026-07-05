# Changelog — 2026-05-16

Jornada con ocho commits sobre cinco frentes distintos: política de privacidad para el App Review de Instagram, arreglo del bug de activación de franjas, nueva pantalla de métricas de Pablo, mejoras de usabilidad y limpieza del header. Cierre del día con timestamps en los mensajes de chat.

---

## Política de privacidad pública

**Por qué:** prerrequisito para el App Review de Meta (Instagram). Sin URL pública con política real, Meta rechaza la submission.

**Qué se hizo:**

- Nueva ruta pública `/privacy` accesible en `https://akutracker.up.railway.app/privacy` (sin autenticación).
- Contenido completo en español adaptado a Colombia (Ley 1581 de 2012, mención a la SIC).
- Cubre los datos reales que procesa AKU Tracker: padres, estudiantes, conversaciones de WhatsApp/Instagram, Calendly, pagos.
- Lista de encargados/terceros (Supabase, Meta, Twilio, Anthropic, Calendly, Railway).
- Identificación legal: AKUMAYA Educación, NIT **901.609.937-1**, contacto `info@akumaya.co`.

**Commits:**
- `886869d` — feat: Privacy policy public page at /privacy
- `563a02a` — fix: Privacy policy contact info — update email and add NIT

---

## Bug: activación de franjas no creaba sesiones

**Síntoma reportado:** la semana pasada se activaron tres cursos desde Settings (botón "Activar" sobre las franjas horarias). Aparecían como grupos "formando" en Grupos Virtuales, pero sin sesiones ni fechas.

**Causa:** la mutación `activateSlotMutation` en `Settings.tsx` solo creaba el `course_group` y no las 8 `course_sessions` semanales que sí genera el flujo manual de Grupos Virtuales.

**Fix:**
- Importación de `generateSessionDates` desde `@/lib/holidays`.
- La mutación ahora genera 8 sesiones semanales saltando feriados configurados.
- **Retroactivo:** SQL directo para insertar las 24 sesiones faltantes (8 × 3 grupos) en los grupos `RC1-MAY26-09-B`, `PG1-MAY26-09` y `RBX1-MAY26-09`.

**Commits:**
- `3fdf12f` — fix: Slot activation now generates 8 weekly sessions

---

## Página de estadísticas de Pablo

**Origen:** "me gustaría ver en algún sitio estadísticas de las conversaciones de pablo en el tiempo".

**Nueva ruta `/pablo-stats`** con:

- **KPI cards (4):** total de conversaciones, promedio de mensajes, conversión a lead (%), conversión a alumno (%).
- **Tasa de escalamiento** con barra de progreso.
- **Funnel de conversión** visual con barras superpuestas (total → lead → alumno).
- **Gráfico de línea** de conversaciones nuevas por día (recharts).
- **Gráfico de barras** de distribución por hora del día — útil para detectar picos de demanda.
- **Filtro temporal:** 7d / 30d / 90d / todo el tiempo.

**Acceso:** botón "Stats" en la cabecera de la página de Pablo · Conversaciones (no se agregó al menú principal para no saturarlo).

**Commit:**
- `64df610` — feat: Pablo conversation stats page

---

## Buscador en selector de alumnos

**Origen:** "ese elemento puede funcionar como desplegable pero al mismo tiempo permitir escribir las primeras letras y que funcione como buscador?".

**Qué se hizo:**

- Reemplazo del `Select` de alumno por un combobox `Popover + Command` en el diálogo de inscripción de Grupos Virtuales (`VirtualGroupDetail.tsx`).
- Permite escribir para filtrar el listado en tiempo real, sigue funcionando con clic y teclado.
- Mensaje "No se encontraron alumnos" si la búsqueda no produce resultados.

**Commit:**
- `6874cff` — feat: Searchable student picker in enroll dialog

---

## Limpieza del menú superior

**Origen:** "el menú superior esta muy lleno, creo podemos eliminar la sección de attendance, realmente no se usa".

**Qué se hizo:**

- Eliminadas las rutas `/attendance` y `/attendance/history` de `App.tsx`.
- Borradas las páginas `Attendance.tsx` y `AttendanceHistory.tsx`.
- Removido el ítem "Attendance" y el icono `Calendar` no utilizado del header.
- **La tabla `attendance_records` queda intacta:** se sigue alimentando desde Grupos Virtuales (marcado por sesión) y se muestra en el Detalle de Alumno.
- Renombrado el título del logo: `RoboAcademy` → `AKUMAYA`.

**Commits:**
- `b545f9d` — chore: Remove unused Attendance section from nav
- `17be551` — chore: Rename header logo from RoboAcademy to AKUMAYA

---

## Timestamps en mensajes de chat

**Origen:** "una cosa que no veo en la ventana de chat de pablo es la fecha de los mensajes y las horas".

**Causa raíz:** los mensajes históricos solo guardaban `role` y `content` — sin timestamp por mensaje.

**Qué se hizo:**

- **Edge functions actualizados y desplegados** para que cada mensaje nuevo incluya `timestamp: new Date().toISOString()`:
  - `whatsapp-webhook` (v19)
  - `send-whatsapp` (v8)
  - `start-conversation` (v9)
- **UI de Conversations** ahora muestra:
  - Hora bajo cada burbuja de mensaje (formato `HH:MM`).
  - Separadores de día centrados con etiquetas inteligentes: "Hoy", "Ayer", o la fecha completa.
  - Para mensajes históricos sin timestamp, usa el `updated_at` de la conversación como fallback para el agrupado por día (la hora individual queda oculta).

**Commit:**
- `a9565ea` — feat: Timestamps on chat messages
