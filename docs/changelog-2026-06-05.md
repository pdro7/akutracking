# Changelog — 2026-06-05

Jornada centrada en un problema real de operación: padres que contactan al negocio desde un número de WhatsApp pero al registrarse en el formulario dejan otro número personal distinto. Esto rompía la trazabilidad entre la conversación y el lead/estudiante. Se abordó con la introducción de **teléfonos adicionales** en leads y estudiantes, más las mejoras de búsqueda asociadas.

---

## Teléfonos adicionales en leads

**Por qué:** un mismo padre puede contactarnos por un número (el "de la casa" o del cónyuge) y luego llenar el formulario de Calendly con su número personal. Sin un lugar para guardar el número secundario, la conversación de WhatsApp quedaba desconectada del lead.

**Qué se hizo:**

- Nueva columna `additional_phones: text[]` en la tabla `leads`.
- En `LeadDetail.tsx`, sección en el diálogo de edición para añadir/quitar teléfonos adicionales (Enter para añadir, botón para quitar).
- Header del lead muestra "Otros tel.: +57… · +57…" cuando existen.
- La consulta de la conversación asociada al lead ahora usa un filtro PostgREST `.or()` que busca la conversación por `lead_id` **o** por cualquiera de los teléfonos (principal + adicionales), en las variantes con y sin prefijo `whatsapp:` para cubrir el formato de Twilio.
- Búsqueda en la lista de Conversaciones (`Conversations.tsx`) matchea también contra `additional_phones` — con búsqueda por solo dígitos.

**Commit:** `a45e402` — feat: Additional phones on leads + searchable Conversations list

---

## Teléfonos adicionales en estudiantes

**Por qué:** el mismo problema se replica una vez el lead se convierte en estudiante inscrito. El detalle y edición de estudiante necesitaban el mismo campo.

**Qué se hizo:**

- Nueva columna `additional_phones: text[]` en `students`.
- `EditStudent.tsx`: sección con el mismo patrón (añadir/quitar, init desde el estudiante en `useEffect`).
- `StudentDetail.tsx`: los teléfonos adicionales se muestran debajo del principal en color gris.

**Commit:** `3debcb3` — feat: Additional phones in student edit/detail views

---

## Búsqueda de estudiantes por teléfonos secundarios

**Por qué:** al añadir teléfonos adicionales, la búsqueda en la lista de Estudiantes seguía ignorándolos, lo que ocultaba coincidencias legítimas.

**Qué se hizo:**

- Filtro en `Students.tsx` amplía el match a `additional_phones`, tanto por coincidencia literal como por solo dígitos (`termDigits`). Escribir "1234" encuentra cualquier estudiante con esos cuatro dígitos en cualquiera de sus números.

**Commit:** `287e27f` — feat: Students list search matches additional_phones too

---

## Flujo operativo recomendado

Cuando llega una conversación de WhatsApp desde un número que no matchea con ningún lead/estudiante:

1. Confirmar con el padre cuál es su número personal (el que va a usar en el formulario).
2. Si ya existe el lead con el otro número, editar el lead y añadir el número desde el que contactó como teléfono adicional.
3. La conversación aparece automáticamente vinculada al lead en `LeadDetail`.

Esto evita duplicados sin necesidad de fusionar registros (Opción B, no implementada por ahora).
