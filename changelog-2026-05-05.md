# Changelog — 2026-05-05

## Unificación de `trial_leads` en `leads` (refactor mayor)

Este es el cambio estructural más grande realizado hasta ahora en AKU Tracker. Antes existían dos tablas paralelas que representaban la misma entidad en diferentes etapas del pipeline: `leads` (contactos entrantes por WhatsApp, web, etc.) y `trial_leads` (agendamientos de clase de prueba desde Calendly). Esto generaba duplicación de datos, estados desconectados entre sí y dificultad para tener una vista unificada del embudo de ventas.

### Problema que resolvía

- Un alumno que llegaba por Calendly existía como `trial_lead` (con sus estados: scheduled, attended, converted…) y a veces también como `lead` (con sus propios estados: new, contacted, enrolled…), sin conexión automática entre ambos.
- Los estados del pipeline eran independientes: cambiar uno no actualizaba el otro.
- El webhook de Calendly creaba registros en `trial_leads`, pero no en `leads`, fragmentando el historial.

### Solución implementada

Se ejecutó en 5 pasos validados uno a uno:

---

#### Step 1 — Webhook de Calendly escribe en `leads`

**Archivos:** `supabase/functions/calendly-webhook/index.ts`

El webhook fue reescrito para trabajar directamente con la tabla `leads` en lugar de `trial_leads`. La lógica de matching es:

1. Si ya existe un lead con el mismo `calendly_uri` → actualizar (re-agendamiento).
2. Si existe un lead con el mismo teléfono normalizado (últimos 10 dígitos) → enriquecer con datos de la prueba.
3. Si no hay match → crear nuevo lead con `source = 'calendly'`, `status = 'trial_scheduled'`.

La cancelación (`invitee.canceled`) ahora actualiza `leads.status = 'trial_cancelled'`.

**Nuevos campos añadidos a `leads` antes del deploy:**
- `trial_class_time` (time)
- `trial_teacher_id` (uuid FK → teachers)
- `trial_course_id` (uuid FK → virtual_courses)
- `trial_objection` (text)
- `notes` (text)

**Nuevos valores en el enum `lead_status`:**
- `interested`
- `trial_cancelled`

---

#### Step 2 — Migración de datos existentes

**Migración SQL:** `migrate_trial_leads_into_leads`

Los 20 registros en `trial_leads` fueron migrados a `leads`:

- **18 registros** ya tenían un lead correspondiente (mismo `calendly_uri`) → se enriquecieron con los campos de prueba.
- **2 registros** sin match → se insertaron como nuevos leads.

Mapeo de estados:

| `trial_lead_status` (viejo) | `lead_status` (nuevo) |
|---|---|
| `scheduled` | `trial_scheduled` |
| `attended` | `trial_attended` |
| `cancelled` | `trial_cancelled` |
| `no_show` | `trial_no_show` |
| `converted` | `enrolled` |
| `interested` | `interested` |

---

#### Step 3 — Páginas de "Clases de Prueba" reescritas

**Archivos:** `src/pages/TrialLeads.tsx`, `src/pages/TrialLeadDetail.tsx`, `src/pages/NewTrialLead.tsx`

Las tres páginas ahora consultan la tabla `leads` en lugar de `trial_leads`:

- `TrialLeads.tsx`: filtra leads donde `trial_class_date IS NOT NULL`. Usa el join `trial_teacher:teachers!trial_teacher_id(name)`. Los botones de filtro usan los nuevos valores del enum (`trial_scheduled`, `trial_attended`, etc.) con etiquetas en español.
- `TrialLeadDetail.tsx`: lee y escribe en `leads`. Removed la sección "Lead vinculado" (ya no tiene sentido — el trial lead ES el lead). El botón "Convertir a alumno" ahora pone `leads.status = 'enrolled'`.
- `NewTrialLead.tsx`: inserta en `leads` con `source = 'other'` y redirige al detalle del lead creado.

---

#### Step 4 — Lead Detail muestra datos de clase de prueba

**Archivo:** `src/pages/LeadDetail.tsx`

Se añadió una sección "Clase de prueba" (visible solo cuando `trial_class_date` tiene valor) que muestra:
- Fecha y hora (en hora Colombia, UTC-5)
- Profesor asignado (`trial_teacher_id`)
- Curso asignado (`trial_course_id`)
- Objeción (`trial_objection`)

El diálogo de edición fue extendido con todos estos campos nuevos (fecha, hora, profesor, curso, objeción) organizados en una subsección separada visualmente.

También se añadieron al `STATUS_CONFIG` los nuevos estados `interested` y `trial_cancelled`, y `reactivation` al `SOURCE_LABELS`.

---

#### Step 5 — Limpieza

- **DB:** `DROP TABLE trial_leads CASCADE` + `DROP TYPE trial_lead_status`
- **TypeScript:** `src/integrations/supabase/types.ts` regenerado — `trial_leads` eliminado, `leads` ahora incluye todos los campos de prueba, el enum `lead_status` tiene los 9 valores finales.

---

### Estado final del enum `lead_status`

```
new → contacted → interested → trial_scheduled → trial_attended → enrolled
                                               ↘ trial_no_show
                                               ↘ trial_cancelled
                              → lost (en cualquier punto)
```

### Commits del refactor

```
d3ee1a4  feat(step-1): Calendly webhook writes to leads table directly
8eb11fc  feat(step-3): Trial leads pages query leads table directly
056c514  feat(step-4): Add trial class section to Lead Detail
c317f53  feat(step-5): Drop trial_leads table and refresh TypeScript types
```
