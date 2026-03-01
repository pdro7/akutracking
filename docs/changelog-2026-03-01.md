# Changelog — 1 de marzo de 2026

Resumen de todos los cambios, mejoras y correcciones realizados durante la sesión de hoy.

---

## 1. Inserción directa de estudiantes vía SQL

### Qué se hizo
Se registraron tres nuevos alumnos directamente en la base de datos usando Supabase MCP (sin necesidad de rellenar el formulario manual), para agilizar la carga de inscripciones en bloque.

**Alumnos insertados:**
- Sebastian Mejía Palencia (madre: Katerine Palencia Mejía / padre: Angelo Mejía Martinez) — Real Coders 1
- Julian Samuel Parra Meneses (padre: Javier Parra Espitia) — Real Coders Zero
- Samuel Josué Vargas Carrillo (madre: Sandy Mayerly Carrillo Hernández) — Real Coders Zero

Todos con `modality: 'virtual'` y `classes_remaining: 0` (pendientes de inscribir en su grupo virtual).

---

## 2. Fix: mes en el código del grupo usaba la fecha actual en vez de la fecha de inicio

### Problema
Al crear un grupo virtual, el segmento del mes en el código (ej. `RC1-FEB26-19`) se generaba a partir de `toLocaleString()`, que en algunos entornos o navegadores podía tomar la fecha actual del sistema en lugar de la fecha de inicio del curso introducida en el formulario.

### Solución
Se reemplazó `toLocaleString('en', { month: 'short' })` por un array fijo de meses:
```ts
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const month = MONTHS[startDate.getMonth()];
```
Así el mes siempre corresponde a la fecha de inicio seleccionada, sin depender del locale ni del sistema.

**Archivo:** `src/pages/VirtualGroups.tsx`

---

## 3. Mejora: sufijo `-B` cuando dos grupos del mismo curso inician el mismo día

### Contexto
El código de grupo tiene restricción `UNIQUE`. Si se creaban dos grupos del mismo curso en la misma fecha, el segundo fallaba con un error de duplicado.

### Solución
Antes de insertar, se comprueba si ya existe un grupo con el código base:
- Primer grupo → `RC1-MAR26-01` (sin sufijo)
- Segundo grupo → `RC1-MAR26-01-B`

El preview del código en el formulario también refleja el sufijo en tiempo real mediante una `useQuery` que comprueba la colisión antes de guardar.

**Archivo:** `src/pages/VirtualGroups.tsx`

---

## 4. Nueva funcionalidad: editar información de un grupo virtual

### Problema
Una vez creado un grupo, no había forma de corregir la fecha de inicio, fecha de fin o notas. Solo era posible cambiar el estado.

### Solución
Se añadió un botón **"Editar"** en el header del detalle del grupo que abre un dialog con los campos:
- Fecha de inicio
- Fecha de fin (opcional)
- Notas (opcional)

La mutación actualiza `course_groups` con los nuevos valores.

**Archivo:** `src/pages/VirtualGroupDetail.tsx`

---

## 5. Nueva funcionalidad: gestión de profesores y asignación a grupos

### Qué se hizo
Se implementó un sistema completo de profesores en tres partes:

#### 5a. Base de datos
- Nueva tabla `teachers` con columnas `id`, `name`, `is_active`, `created_at`
- RLS habilitado con políticas de lectura y escritura para usuarios autenticados
- Nueva columna `teacher_id` (FK → `teachers.id`, `ON DELETE SET NULL`) en `course_groups`
- Seed con los 8 profesores actuales: Nicolás, David, Daniela, María Fernanda, Juanes, Juan, Andrés, Paula

#### 5b. Settings — Sección "Profesores"
Se añadió una nueva sección en `Settings.tsx` con:
- Lista de todos los profesores
- Botón para añadir nuevo profesor
- Botón de editar nombre
- Botón de eliminar (con confirmación)

#### 5c. Crear grupo — selector de profesor
En el formulario de "Nuevo grupo" se añadió un campo select para asignar un profesor (opcional).

#### 5d. Detalle del grupo — mostrar y editar profesor
- El header del grupo ahora muestra el nombre del profesor asignado
- El dialog de "Editar grupo" incluye el selector de profesor para poder cambiarlo

**Archivos modificados:**
- `supabase/migrations/` — migración `add_teachers`
- `src/integrations/supabase/types.ts` — tipos actualizados con la nueva tabla
- `src/pages/Settings.tsx`
- `src/pages/VirtualGroups.tsx`
- `src/pages/VirtualGroupDetail.tsx`

---

## 6. Fix: dialogs no funcionaban tras añadir el selector de profesor

### Problema 1 — `SelectItem` con `value=""`
Radix UI (la librería de componentes que usa shadcn/ui) **no soporta** el valor `""` (cadena vacía) en `SelectItem`. Al usar `value=""` para la opción "Sin profesor asignado", el componente Select quedaba en un estado inválido que podía bloquear la interacción con el dialog completo (botones de guardar no respondían).

### Solución
Se reemplazó `value=""` por `value="none"` en todos los SelectItem de "sin asignación", con la correspondiente conversión al guardar:
```ts
teacher_id: teacherId && teacherId !== 'none' ? teacherId : null
```

### Problema 2 — Dialog demasiado alto, botones fuera de pantalla
Al añadir el selector de profesor y otros campos, el formulario de "Nuevo grupo" superaba la altura de la pantalla, empujando los botones de "Cancelar" y "Crear grupo" fuera del área visible.

### Solución
Se añadió scroll al contenido del dialog:
```tsx
<div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
```

**Archivos:** `src/pages/VirtualGroups.tsx`, `src/pages/VirtualGroupDetail.tsx`

---

## Resumen de archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `supabase/migrations/add_teachers` | Nueva migración (tabla teachers + FK en course_groups) |
| `src/integrations/supabase/types.ts` | Tipos actualizados con `teachers` y `teacher_id` |
| `src/pages/Settings.tsx` | Nueva sección "Profesores" con CRUD |
| `src/pages/VirtualGroups.tsx` | Fix mes, sufijo -B, selector de profesor, fix dialog overflow |
| `src/pages/VirtualGroupDetail.tsx` | Dialog editar grupo, selector profesor en edición, fix SelectItem |

## Commits del día

```
fix: Replace empty string SelectItem value and add dialog overflow scroll
feat: Add teachers management and assign teacher to virtual groups
feat: Track pending first payments on virtual enrollments (sesión anterior)
fix: Show amount in payment pending detail + re-enrollment fix (sesión anterior)
```
