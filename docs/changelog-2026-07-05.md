# Changelog — 2026-07-05

Jornada larga con dos frentes principales: arranque de la formación de grupos bajo demanda (Fase 1 completa) y endurecimiento del flujo de auth después de descubrir un bug que dejaba a los profes invitados con acceso admin. Cierra con la captura self-service de preferencias, tanto para leads existentes como para tráfico directo.

---

## Formación de grupos "bajo demanda" — Fase 1

**Por qué:** grupos con fechas fijas llegan al día de inicio con 1–2 niños. Un grupo con 2 niños es económicamente inviable y bloquea profesor + franja durante 2 meses. La idea es que la fecha del grupo **emerja** cuando hay masa crítica de leads compatibles en curso × franja × modalidad, respetando materias y disponibilidad del profe.

**Fase 1 = solo captura de datos.** El motor de matching y la vista "Formación de grupos" son Fase 2.

**Qué se hizo:**

- Migración de schema:
  - `leads`: `interested_course_id` (FK a `virtual_courses`), `preferred_slots` (jsonb), `preferred_modality`, `desired_start_by`.
  - `teachers`: `subjects` (text[]), `availability` (jsonb), `modalities` (text[]).
  - `virtual_courses`: `subject` (text), `min_students_to_open` (int, default 4). Backfill del `subject` cubre los 18 cursos (robotica/python/minecraft/roblox/unity/youtube/ia).
- Catálogo compartido de franjas `src/lib/timeSlots.ts` con IDs estables y buckets: sáb AM/PM, entre semana AM/PM. Franjas: sáb 09–10:30, 10:30–12, 14–15:30, 15:30–17; L–V AM 09–10:30; L–V PM 16:30–18 (simplificado desde el catálogo inicial más grande — nadie tenía datos usando los slots quitados).
- Componente compartido `TimeSlotPicker` (chips por bucket, ToggleGroup multi-select).
- Constantes `SUBJECTS`, `MODALITIES`, `LEAD_MODALITY_OPTIONS` en `src/lib/subjects.ts`.
- Captura de preferencias en `NewLead`, `NewTrialLead`, `LeadDetail` (diálogo de edición). El campo `course_interest` texto libre queda como respaldo secundario ("notas de interés").
- Portal del profe en `/teacher/availability`: el profe edita sus materias, franjas y modalidades. Link "Mi disponibilidad" añadido al Header cuando `isTeacher`.
- Editor admin en Settings extendido con los mismos tres campos.

**Commits:**
- `e0b93fb` — feat: Demand-driven group formation — Phase 1 schema and lead capture
- `665eb5a` — feat: Teacher self-service availability portal
- `a94b6b4` — chore: Simplify weekday slots to the ones we actually offer

---

## Bug crítico: profes invitados quedaban como admin de facto

**Síntoma:** los profes que se invitaban con "Enviar invitación" entraban a la app con acceso a todo (leads, students, settings, etc.), en vez de ver solo sus grupos.

**Causa raíz:** la tabla `user_roles` no tenía UNIQUE constraint en `user_id`. La edge function `invite-teacher` hacía un `upsert` con `ON CONFLICT (user_id)`, que fallaba silenciosamente al ejecutarse. El rol `teacher` **nunca** llegaba a guardarse. El fallback en `useUserRole` era `'staff'`, que a nivel de rutas se comporta prácticamente como admin.

**Qué se arregló:**

- Migración `20260705000021` añade UNIQUE en `user_roles.user_id`. Reejecutar backfill para los profes existentes (`pdro07`, `akumayabga`).
- Fallback de `useUserRole` cambiado de `'staff'` a `'unassigned'`.
- `NoTeacher` en `App.tsx` ahora deja pasar **solo** `admin | staff`. `teacher` va a `/virtual-groups`. `unassigned` ve pantalla "Sin acceso" en lugar de heredar permisos.
- Nuevo hook `useAuthCacheInvalidation` conectado al app shell: invalida las queries `userRole`/`teacherRecord`/`profile` en cada `onAuthStateChange` para que la caché de una sesión previa no filtre roles al siguiente usuario.

**Commit:** `61320a4` (bundled con el resto del hardening de auth).

---

## Endurecimiento del flujo de auth

Cambios adicionales descubiertos mientras probábamos la invitación:

- **Página `/set-password`** (`SetPassword.tsx`): destino del link de invitación. Detecta la sesión que Supabase crea al procesar el hash del email, pide contraseña + confirmación, llama `updateUser({ password })` y redirige a `/`. Si el link expiró/reutilizado, muestra mensaje amigable.
- **Edge function `invite-teacher` v11**: acepta parámetro `redirect_to` y lo pasa a `inviteUserByEmail`. El cliente en Settings envía `${window.location.origin}/set-password`.
- **Edge function `delete-teacher` v1**: nueva. La papelera del profe en Settings ya no solo borraba la fila de `teachers` (dejando la cuenta auth y el rol activos, con el email "quemado"); ahora hace teardown completo — `teachers` + `user_roles` + `auth.users` — vía `supabaseAdmin.auth.admin.deleteUser`. Impide auto-eliminación.
- **Auth.tsx sin signup**: se elimina el tab "Sign Up". Solo login. Copy: "acceso solo por invitación". A nivel de Supabase se apagó también "Allow new users to sign up" desde el dashboard.
- **Mensajes de error de edge functions**: `inviteTeacherMutation` y `deleteTeacherMutation` ahora parsean el body de la respuesta 4xx/5xx (`res.error.context.json()`) para mostrar el mensaje real ("A user with this email address has already been registered", "invalid email format", etc.) en vez del genérico "Edge Function returned a non-2xx status code".

**Commit:** `61320a4` — fix: Harden auth flow — invite, password creation, role gating, teacher deletion

---

## Captura self-service de preferencias (dos modos)

**Por qué:** hasta hoy los cuatro campos nuevos (`interested_course_id`, `preferred_slots`, `preferred_modality`, `desired_start_by`) solo se llenaban con staff editando `LeadDetail`. Sin ese trabajo manual, Fase 2 (matcher) tendría datos vacíos. El bot Pablo no está activo en producción — los leads siguen entrando por WhatsApp manual — así que necesitamos un camino directo para que el padre llene sus preferencias solo.

**Qué se hizo:**

- Migración `20260705000022`: `leads.form_token uuid NOT NULL DEFAULT gen_random_uuid()` + índice único. Los 47 leads existentes reciben token vía `DEFAULT`. Se usa el token en lugar del `id` como identificador en URLs públicas para evitar enumeración.
- Componente compartido `InterestForm` (mobile-first, un solo formulario reutilizado en los dos modos).
- **Modo público** (`/interes`, `PublicInterest.tsx` + edge function `submit-interest`): formulario abierto, todos los campos vacíos. Al enviar dedupe por dígitos de teléfono: si ya existe un lead con ese número, se actualiza sin sobrescribir los nombres; si no, se crea nuevo con `source='web'` y `status='new'`.
- **Modo tokenizado** (`/preferencias/:token`, `TokenizedPreferences.tsx` + edge function `lead-preferences`): dos acciones (`read`/`write`). Prellena nombres, teléfono, email, curso y franjas del lead identificado por el token. Los campos siguen siendo editables por si el padre corrige algo. Solo campos "seguros" (whitelist en la edge function) pueden actualizarse por token.
- Botón **"Copiar link preferencias"** en el header del `LeadDetail`: copia `${origin}/preferencias/${form_token}` al portapapeles para pegarlo en WhatsApp.

**Comportamiento cubierto:**

| Origen | Cómo llega | Cómo llena preferencias |
|---|---|---|
| WhatsApp manual (canal actual) | Tú creas el lead conversando | Le pegas el link tokenizado en el chat |
| Calendly (trial book) | Webhook auto-crea el lead | Le compartes el link tokenizado |
| Instagram / referido | Igual | Igual |
| Tráfico frío (QR, redes) | El propio padre abre `/interes` | Llena todo desde cero |

**Commit:** `fc8ac1a` — feat: Public interest form and tokenized preferences link for leads

---

## Cierre y siguiente

Fase 1 lista. Con leads y profes rellenando datos por los distintos canales, hay materia prima para arrancar **Fase 2** — el motor de matching que agrupa leads compatibles y sugiere cuándo abrir un grupo con qué profesor.
