# Integración Calendly → AKU Tracker

Este tutorial documenta cómo conectar Calendly con AKU Tracker para que las reservas de clases de prueba aparezcan automáticamente en el sistema, sin necesidad de introducir los datos manualmente.

---

## Índice

1. [Cómo funciona](#cómo-funciona)
2. [Requisitos previos](#requisitos-previos)
3. [Parte 1 — Preparar la base de datos](#parte-1--preparar-la-base-de-datos)
4. [Parte 2 — Desplegar la Edge Function](#parte-2--desplegar-la-edge-function)
5. [Parte 3 — Configurar el webhook en Calendly](#parte-3--configurar-el-webhook-en-calendly)
6. [Parte 4 — Verificar que funciona](#parte-4--verificar-que-funciona)
7. [Parte 5 — Importar datos históricos](#parte-5--importar-datos-históricos)
8. [Referencia de campos](#referencia-de-campos)
9. [Solución de problemas](#solución-de-problemas)

---

## Cómo funciona

```
Padre reserva clase de prueba en Calendly
          ↓
Calendly envía un webhook (POST automático) a Supabase
          ↓
Edge Function extrae los datos del padre e hijo
          ↓
Se inserta un registro en la tabla trial_leads
          ↓
El lead aparece en AKU Tracker → Trial Class Leads
```

Si el padre **cancela** la reserva en Calendly, el estado del lead se actualiza automáticamente a `cancelled`.

---

## Requisitos previos

- Cuenta de Calendly de pago (el webhook requiere plan estándar o superior)
- Acceso al dashboard de Supabase del proyecto
- El formulario de Calendly debe tener estas **6 preguntas personalizadas** (en este orden):
  1. Celular
  2. Nombre de tu hijo(a)
  3. Edad de tu hijo(a)
  4. Ciudad
  5. ¿Ha tenido experiencia previa con programación?
  6. ¿Cómo nos conociste?

---

## Parte 1 — Preparar la base de datos

Ejecuta esta migración en **Supabase → SQL Editor**:

```sql
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS calendly_uri text UNIQUE;
```

Esta columna almacena el identificador único de cada reserva de Calendly. Sirve para dos cosas:
- Evitar duplicados si el webhook llega más de una vez
- Identificar qué registro actualizar cuando se produce una cancelación

---

## Parte 2 — Desplegar la Edge Function

La Edge Function es el código que recibe los webhooks de Calendly y los procesa.

### Desde el dashboard de Supabase

1. Ve a tu proyecto → menú lateral → **Edge Functions**
2. Haz clic en **"Deploy a new function"**
3. Ponle el nombre exacto: `calendly-webhook`
4. Reemplaza el código del editor con el contenido del archivo:
   `supabase/functions/calendly-webhook/index.ts`
5. Haz clic en **"Deploy"**
6. Una vez desplegada, copia la **URL de la función** — la necesitarás en el siguiente paso. Tiene este formato:
   ```
   https://TUPROJECTREF.supabase.co/functions/v1/calendly-webhook
   ```

### Desactivar la verificación JWT

Por defecto, Supabase exige un token de autenticación en todas las Edge Functions. Calendly no puede enviarlo, así que hay que desactivarlo:

1. En la página de la función → pestaña **Details**
2. Busca **"JWT Verification"** y desactívalo (toggle off)
3. Guarda los cambios

---

## Parte 3 — Configurar el webhook en Calendly

Los webhooks de Calendly se configuran mediante su API, no desde la interfaz web.

### Paso 1 — Obtener un Personal Access Token

1. En Calendly → esquina superior derecha → tu avatar → **Integraciones y aplicaciones**
2. Haz clic en **"Consiga un token ahora"**
3. Crea un nuevo token con el nombre `AKU Tracker`
4. Cópialo — lo usarás en los siguientes comandos

### Paso 2 — Obtener tu Organization URI

```bash
curl -s https://api.calendly.com/users/me \
  -H "Authorization: Bearer TU_TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['resource']['current_organization'])"
```

Devuelve algo como:
```
https://api.calendly.com/organizations/XXXXXXXXXXXXXXXXXX
```

### Paso 3 — Registrar el webhook

```bash
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://TUPROJECTREF.supabase.co/functions/v1/calendly-webhook",
    "events": ["invitee.created", "invitee.canceled"],
    "organization": "https://api.calendly.com/organizations/XXXXXXXXXXXXXXXXXX",
    "scope": "organization"
  }'
```

La respuesta debe mostrar `"state": "active"`:

```json
{
  "resource": {
    "state": "active",
    "callback_url": "https://TUPROJECTREF.supabase.co/functions/v1/calendly-webhook",
    "events": ["invitee.created", "invitee.canceled"],
    ...
  }
}
```

> **Guarda el campo `uri` de la respuesta** (tiene el formato `https://api.calendly.com/webhook_subscriptions/XXXX`). Lo necesitarás si en el futuro quieres consultar o eliminar el webhook.

---

## Parte 4 — Verificar que funciona

### Prueba manual con curl

Crea un archivo de prueba `test.json`:

```bash
echo '{"event":"invitee.created","payload":{"uri":"https://api.calendly.com/test/001","name":"Padre Prueba","email":"prueba@test.com","questions_and_answers":[{"question":"Celular","answer":"+57 300 000 0000"},{"question":"Nombre de tu hijo","answer":"Niño Prueba"},{"question":"Edad","answer":"8 años"},{"question":"Ciudad","answer":"Bogotá"}],"scheduled_event":{"start_time":"2026-03-01T15:00:00.000000Z"}}}' > test.json
```

Envíalo a la función:

```bash
curl -v -X POST "https://TUPROJECTREF.supabase.co/functions/v1/calendly-webhook" \
  -H "Content-Type: application/json" \
  -d @./test.json
```

La respuesta debe ser:
```json
{"ok": true}
```

Verifica en **Supabase → Table Editor → trial_leads** que aparece el registro.

### Prueba real

Haz una reserva de prueba en tu Calendly y comprueba que el lead aparece en **AKU Tracker → Trial Class Leads** con todos los datos del padre y del hijo correctamente rellenados.

---

## Parte 5 — Importar datos históricos

Para los leads que ya tienes en Calendly antes de configurar el webhook, usa la función `importCalendlyLeads()` del Apps Script.

### Paso 1 — Exportar datos de Calendly

1. En Calendly → **Reportes → Actividad**
2. Filtra el rango de fechas que quieras importar
3. Haz clic en **Exportar CSV**

### Paso 2 — Preparar el Google Sheet

1. Abre el Google Sheet vinculado a tu formulario de inscripción
2. Crea una pestaña nueva (ej. `Calendly Export`)
3. Importa el CSV exportado en esa pestaña (**Archivo → Importar**)
4. Asegúrate de que esa pestaña sea la **hoja activa**

### Paso 3 — Ejecutar la importación

1. En el Google Sheet → **Extensiones → Apps Script**
2. Selecciona la función `importCalendlyLeads` en el desplegable
3. Haz clic en **Ejecutar**
4. Revisa el **Log de ejecución** — mostrará algo como:
   ```
   ✅ Fila 2: María García insertada
   ✅ Fila 3: Carlos López insertado
   ──────────────────────────────────────────────────
   Clases de prueba: 15 insertadas, 0 errores, 0 omitidas
   ```

> La función procesa las filas con una pausa de 200ms entre cada una para no saturar la API de Supabase.

---

## Referencia de campos

| Campo en Calendly | Campo en trial_leads |
|---|---|
| Invitee Name | `parent_name` |
| Invitee Email | `parent_email` |
| Response 1 (Celular) | `parent_phone` |
| Response 2 (Nombre del hijo) | `child_name` |
| Start Date & Time | `trial_class_date` |
| Response 3 (Edad) | `notes` (concatenado) |
| Response 4 (Ciudad) | `notes` (concatenado) |
| Response 5 (Experiencia previa) | `notes` (concatenado) |
| Response 6 (Cómo nos conociste) | `notes` (concatenado) |
| Invitee URI | `calendly_uri` |
| Canceled = true | `status = 'cancelled'` |

El campo `notes` agrupa la información secundaria en formato:
```
Edad: 8 años | Ciudad: Bogotá | Exp. previa: Ninguna | Referido: Instagram
```

---

## Solución de problemas

### El lead no aparece después de una reserva

1. Comprueba que el webhook esté activo:
   ```bash
   curl -s https://api.calendly.com/webhook_subscriptions/TU_WEBHOOK_URI \
     -H "Authorization: Bearer TU_TOKEN"
   ```
   Debe mostrar `"state": "active"`. Si `retry_started_at` tiene valor, Calendly está reintentando — revisa los logs de la Edge Function.

2. Revisa los logs en **Supabase → Edge Functions → calendly-webhook → Logs**.

3. Verifica que el JWT Verification esté desactivado en la función.

4. Verifica que la migración se ejecutó:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'trial_leads' AND column_name = 'calendly_uri';
   ```

### Error `Could not find the 'calendly_uri' column`

La migración no se ejecutó. Corre en el SQL Editor:
```sql
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS calendly_uri text UNIQUE;
```

### Error `401 Missing authorization header`

El JWT Verification está activado. Desactívalo en **Edge Functions → calendly-webhook → Details → JWT Verification**.

### El curl devuelve `zsh: no such file or directory`

El comando tiene saltos de línea introducidos por el chat. Usa siempre el enfoque de archivo:
```bash
echo 'TU_JSON_EN_UNA_SOLA_LINEA' > test.json
curl -X POST "URL" -H "Content-Type: application/json" -d @./test.json
```
