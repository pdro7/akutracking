# Changelog — 11 de marzo de 2026

Resumen de todos los cambios, mejoras y correcciones realizados durante la sesión de hoy.

---

## 1. Fix: registro de pagos pendientes desde la ficha del estudiante + cambio de plan de pago

### Qué se hizo
- En la ficha del estudiante (sección "Cursos Virtuales"), se añadieron botones clicables para registrar pagos directamente desde ahí:
  - **"⚠️ Pago pendiente — Registrar"** cuando la 1ª cuota / pago completo no ha sido recibido
  - **"2ª cuota pendiente — Registrar"** cuando la 2ª cuota está pendiente (con alerta en rojo si está próxima a vencer)
- Se añadió un dialog para ingresar fecha, monto, método de pago y notas
- El nombre del curso es ahora un enlace clicable que navega al detalle del grupo
- En el dialog de **"Editar inscripción"** (vista del grupo), se añadió un selector de plan de pago que permite cambiar entre "Pago completo" y "En cuotas". Los campos de 2ª cuota aparecen/desaparecen dinámicamente según el plan seleccionado

**Archivo:** `src/pages/StudentDetail.tsx`, `src/pages/VirtualGroupDetail.tsx`

---

## 2. Fix: los métodos de pago en Settings no se guardaban

### Problema
Al añadir un nuevo método de pago en General Settings y dar "Save", el cambio parecía guardarse pero desaparecía al refrescar la página.

### Causas encontradas
1. El `queryFn` de React Query llamaba a `setPaymentMethods()` directamente, lo que provocaba que los refetches en segundo plano (al cambiar el foco de ventana) sobreescribieran los cambios del usuario antes de guardar
2. El usuario no sabía que había que pulsar "+" antes de "Save" para añadir el método al array

### Solución
- Se movió la inicialización del estado a un `useEffect` que solo se ejecuta una vez al cargar los datos (no en refetches)
- El botón "Save Settings" ahora incluye automáticamente cualquier texto que esté en el campo de nuevo método, sin necesidad de pulsar "+" primero
- Se añadió `.select()` al UPDATE para detectar si RLS bloqueaba la operación silenciosamente

**Archivo:** `src/pages/Settings.tsx`

---

## 3. Fix: typo "Bancololombia" → "Bancolombia" en datos históricos

### Problema
Al corregir el nombre del método de pago en los ajustes, los pagos históricos seguían guardados como "Bancololombia", creando dos categorías separadas en el gráfico de Payment Summary.

### Solución
Se ejecutó un UPDATE directo en la base de datos para unificar todos los registros:
```sql
UPDATE public.payments
SET payment_method = 'Bancolombia'
WHERE payment_method = 'Bancololombia';
```
Los 17 pagos históricos quedaron consolidados bajo "Bancolombia".

---

## 4. Nueva funcionalidad: card "Pending Revenue" en Payment Summary

Se añadió una segunda card junto a "Total Revenue" que muestra:
- **Total acumulado** pendiente de cobrar (1ª cuota sin registrar + 2ª cuotas pendientes de inscripciones virtuales activas)
- **Número de pagos** pendientes
- Color naranja para distinguirlo del revenue ya cobrado

Este valor es global (no se filtra por año/mes).

**Archivo:** `src/pages/Payments.tsx`

---

## 5. Fix: auto-crear registro de pago al marcar inscripción como pagada (edición)

### Problema
Cuando desde la ficha del grupo se editaba una inscripción y se ponía una fecha de pago, el registro **no** se creaba en Payment History.

### Solución
En `updateEnrollmentMutation`, si `installment_1_paid_at` o `installment_2_paid_at` se establecen por primera vez, se inserta automáticamente un registro en la tabla `payments` con:
- Monto e fecha correspondientes
- Método: `"Unknown"` (editable después desde Payment History)
- Nota descriptiva: "Pago completo (curso virtual)", "1ª cuota (curso virtual)" o "2ª cuota (curso virtual)"

**Archivo:** `src/pages/VirtualGroupDetail.tsx`

---

## 6. Fix: mostrar alerta de 2ª cuota aunque la 1ª no esté pagada

### Problema
En la ficha del estudiante, la alerta de "2ª cuota pendiente" solo aparecía si la 1ª cuota ya estaba pagada. Si ambas estaban pendientes, solo se mostraba una alerta.

### Solución
Se eliminó la condición `enrollment.installment_1_paid_at &&` de la verificación de la 2ª cuota. Ahora ambas alertas son independientes y se muestran simultáneamente cuando corresponde.

**Archivo:** `src/pages/StudentDetail.tsx`

---

## 7. Fix: auto-crear registro de pago al inscribir un estudiante con pago recibido

### Problema
El mismo comportamiento de auto-creación de pagos que se añadió al editar una inscripción no estaba presente al **crear** una nueva inscripción.

### Solución
Se añadió la misma lógica en `enrollMutation`: si al inscribir se marca el pago como recibido (`installment_1_paid_at` + `installment_1_amount`), se inserta automáticamente el registro en `payments`.

**Archivo:** `src/pages/VirtualGroupDetail.tsx`

---

## 8. Diagnóstico y corrección del Google Apps Script

### Problema
Un estudiante que se registró vía Google Forms no apareció en la plataforma.

### Causas encontradas
1. **URL sin configurar**: `SUPABASE_URL` tenía el valor de ejemplo `'https://TU-PROYECTO.supabase.co'` → error DNS en cada envío de formulario
2. **RLS bloqueando inserts**: el script usaba la `anon key`, que no tiene política de INSERT en la tabla `students`. Solo los usuarios con rol `admin` pueden insertar

### Solución aplicada
- Se configuró la URL correcta: `https://kmjordmkybqvihcgosct.supabase.co`
- Se reemplazó la `anon key` por la `service_role key` (el script corre server-side en Google, por lo que es seguro usarla)
- Se verificó la conexión con `testConnection()` → status 200 ✓

### Estudiante insertado manualmente
**Manuel Soto Chezzio** fue insertado directamente vía SQL junto con su pago de $312.000 (método: Unknown, pendiente de actualizar).

---

## 9. Mejora: ordenar y colorear las cards de Payment Summary

### Cambios
- Las cards y el gráfico de barras ahora están **ordenados de mayor a menor** ingreso total
- Cada método de pago tiene un **color fijo** consistente entre el gráfico y las cards:

| Método | Color |
|---|---|
| Bancolombia | Azul (`#1d4ed8`) |
| Davivienda | Rojo-rosa (`#f43f5e`) |
| Wompi | Celeste (`#38bdf8`) |
| BCP | Gris (`#9ca3af`) |
| Unknown | Violeta (`#a78bfa`) |

- Las cards tienen un **borde superior** del color correspondiente al método
- Los métodos no listados usan una paleta de colores por defecto

**Archivo:** `src/pages/Payments.tsx`

---

## Resumen de archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `src/pages/StudentDetail.tsx` | Fix alerta 2ª cuota · botones registro pago · enlace curso |
| `src/pages/VirtualGroupDetail.tsx` | Auto-pago al crear/editar inscripción · selector plan de pago |
| `src/pages/Settings.tsx` | Fix guardado métodos de pago · auto-añadir en Save |
| `src/pages/Payments.tsx` | Card Pending Revenue · orden y colores por método |

## Commits del día

```
feat: Sort payment method cards by revenue + custom colors per method
fix: Auto-create payment record when enrolling student with payment received
fix: Show 2nd installment pending alert even when 1st is not yet paid
feat: Auto-create payment record when marking enrollment as paid from group detail
feat: Add Pending Revenue card in Payment Summary
fix: Auto-add pending payment method on Save + fix state initialization
feat: Register pending payments from student detail + change payment plan in edit enrollment
```
