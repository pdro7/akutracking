# Changelog — 25–26 de abril de 2026

## Nuevas funcionalidades

### Rol de profesor (`teacher`)
- Nuevo rol `teacher` añadido al enum `app_role` en la base de datos.
- Los profesores solo tienen acceso a la página **Mis grupos**, que muestra únicamente los grupos que tienen asignados.
- Cualquier intento de acceder a otras rutas (Dashboard, Students, Payments, etc.) redirige automáticamente a `/virtual-groups`.
- El menú de navegación se simplifica para profesores: solo aparece el ítem "Mis grupos".

### Invitación de profesores desde Settings
- Nueva columna `email` en la tabla `teachers` para vincular un registro de profesor con una cuenta de autenticación.
- En Settings → Profesores, al editar un profesor se puede asignar su email de cuenta.
- Botón **"Enviar invitación"** que llama a una Edge Function (`invite-teacher`) para enviar un email de invitación a través de Supabase Auth.
- Al aceptar la invitación, el profesor queda automáticamente con rol `teacher` y su cuenta vinculada al registro.
- La tabla muestra **"✓ Activo"** cuando la cuenta ya ha sido activada.

## Correcciones

### Estado "Payment Due" con clases negativas
- Antes, un estudiante con `classes_remaining = -1` aparecía como "Low Credits" en lugar de "Payment Due".
- Corregido: cualquier valor `<= 0` ahora muestra correctamente el estado "Payment Due".
- El Dashboard incluye ahora a estos estudiantes en la sección "Pendientes de pago".
- El detalle de clases restantes muestra "X clases en deuda" cuando el valor es negativo.

### Botón "Marcar solicitado" para estudiantes con pack individual
- El botón "Marcar solicitado" ya estaba disponible para cuotas de cursos virtuales, pero no para estudiantes individuales con pack agotado.
- Nueva columna `pack_payment_requested_at` en la tabla `students`.
- El Dashboard ahora muestra el botón/badge "✓ Solicitado" también para estos estudiantes.
- Al registrar un nuevo pago, `pack_payment_requested_at` se resetea automáticamente a `NULL`.

### Cálculo de clases restantes al registrar un pago
- Al registrar un nuevo pack, el cálculo anterior (`pack_size - classes_attended`) era incorrecto porque `classes_attended` es acumulativo.
- Corregido: al registrar un nuevo pago se suma el nuevo pack a las clases restantes actuales (`classes_remaining + pack_size`), respetando cualquier deuda o saldo previo.

## Despliegue en producción (Railway)

- Eliminado `bun.lockb` del repositorio para que Railway use npm con el `package-lock.json` existente.
- Añadido `--host 0.0.0.0` al script `preview` de Vite para que el servidor acepte conexiones externas dentro del contenedor de Railway.
- Configuradas las variables de entorno `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_SUPABASE_PROJECT_ID` en Railway.
- Actualizada la **Site URL** y **Redirect URLs** en Supabase Auth con el dominio de producción `https://akutracker.up.railway.app`.
