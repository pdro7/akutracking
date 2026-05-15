# Integración Instagram — AKU Tracker

Documento técnico que registra todo el proceso de integración de DMs de Instagram con AKU Tracker. Cubre la configuración en Meta, los componentes de backend y frontend, los puntos de fricción encontrados durante la implementación y los pasos pendientes para llegar a producción.

---

## 1. Objetivo

Recibir los mensajes directos (DMs) que llegan a **@akumaya** en Instagram y mostrarlos en AKU Tracker para que el equipo pueda responder manualmente desde la app de Instagram. En una fase posterior, integrar al agente Pablo para que responda automáticamente igual que en WhatsApp.

---

## 2. Arquitectura

```
DM en Instagram
       │
       ▼
Meta (Instagram Graph API via Facebook Page)
       │  webhook POST
       ▼
Supabase Edge Function: instagram-webhook
       │  insert / append
       ▼
Tabla: instagram_conversations
       │  query (auto-refresh)
       ▼
AKU Tracker UI: /instagram
```

**Decisión de diseño clave:** se eligió la ruta de **"Inicio de sesión con Facebook"** en lugar de la nueva "Instagram Login API" porque @akumaya ya está conectada a una página de Facebook administrada por Pedro. Esto evita el problema de tener que agregar la cuenta de Instagram como "tester" mediante un flujo de OAuth separado.

---

## 3. Configuración en Meta

### 3.1 App de Meta

- **App ID:** `4495931967321788`
- **Nombre:** Akumayaig
- **Tipo:** Business
- **Propietario:** AKUMAYA Business Manager
- **Caso de uso principal añadido:** *Administrar mensajes y contenido en Instagram*
- **Caso de uso adicional añadido (necesario):** *Interactúa con los clientes en Messenger from Meta*

> Sin el caso de uso de Messenger, no aparece el permiso `pages_messaging` en la lista, y la suscripción a `messages` falla con error `#200`.

### 3.2 Permisos añadidos

Vía la pestaña "Permisos y funciones" de cada caso de uso:

**Mensajería:**
- `instagram_basic`
- `instagram_manage_messages`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`
- `pages_messaging` (vía caso de uso Messenger)
- `pages_manage_metadata` (vía caso de uso Messenger)

### 3.3 Webhook configurado

En la sección "Configura los webhooks" del caso de uso de Instagram:

- **URL de devolución de llamada:**
  `https://kmjordmkybqvihcgosct.supabase.co/functions/v1/instagram-webhook`
- **Identificador de verificación:** valor arbitrario que coincide entre Meta y Supabase. Actualmente:
  `aku_maya_ig_2026_verify`

La verificación inicial (GET con `hub.challenge`) pasó y la sección quedó en verde.

### 3.4 IDs relevantes

- **Página de Facebook:** Akumaya Educación
  - **Page ID:** `107322244516890`
- **Instagram Business Account ID:** `17841444336445691`
- **Instagram App ID** (sub-identificador del producto Instagram): `836880116130054`

### 3.5 Suscripción de la página al webhook

Se hizo manualmente vía **Graph API Explorer** con el Page Access Token:

```http
POST /107322244516890/subscribed_apps?subscribed_fields=messages
```

Respuesta: `{"success": true}`

> Esto fue lo que confirmó que la página queda recibiendo notificaciones de mensajes entrantes.

---

## 4. Secretos en Supabase

Configurados en *Edge Functions → Manage secrets*:

| Nombre | Origen |
|---|---|
| `INSTAGRAM_VERIFY_TOKEN` | valor arbitrario, debe coincidir con el de Meta |
| `INSTAGRAM_APP_SECRET` | clave secreta del App ID `4495931967321788` (panel principal de Meta) |
| `INSTAGRAM_PAGE_TOKEN` | Page Access Token obtenido vía Graph API Explorer |

> El `INSTAGRAM_APP_SECRET` es el del **App principal**, no el del Instagram App ID. Esa diferencia causó confusión en el setup.

---

## 5. Base de datos

### Migración: `add_instagram_source_and_conversations`

Cambios:

```sql
-- Nuevo valor para el enum
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'instagram';

-- Tabla principal
CREATE TABLE instagram_conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid REFERENCES leads(id) ON DELETE SET NULL,
  instagram_user_id   text NOT NULL,
  instagram_username  text,
  messages            jsonb NOT NULL DEFAULT '[]'::jsonb,
  status              text NOT NULL DEFAULT 'open',
  unread              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Unicidad por usuario de Instagram
CREATE UNIQUE INDEX instagram_conversations_user_id_key
  ON instagram_conversations(instagram_user_id);

-- RLS abierta a autenticados
ALTER TABLE instagram_conversations ENABLE ROW LEVEL SECURITY;
-- + policies SELECT y UPDATE para authenticated
```

Estructura del campo `messages` (JSONB):

```json
[
  {
    "role": "user",
    "content": "Hola, quiero info de los cursos",
    "message_id": "m_abc123",
    "attachments": null,
    "timestamp": "2026-05-15T18:32:01.000Z"
  }
]
```

---

## 6. Edge Function: `instagram-webhook`

Archivo: `supabase/functions/instagram-webhook/index.ts`

**Características:**

- `verify_jwt: false` — Meta no envía JWT; la seguridad está en la verificación de firma HMAC con `INSTAGRAM_APP_SECRET`.
- **GET:** responde el challenge de verificación de Meta cuando `hub.verify_token` coincide con `INSTAGRAM_VERIFY_TOKEN`.
- **POST:**
  1. Verifica firma `x-hub-signature-256` (HMAC-SHA256 con el App Secret).
  2. Itera por `body.entry[].messaging[]`.
  3. Filtra echoes (mensajes salientes propios).
  4. Identifica al usuario remoto (sender ≠ accountId).
  5. Upsert por `instagram_user_id`:
     - Si existe: append al array `messages` + `unread = true`.
     - Si no: insert con primer mensaje.

---

## 7. UI en AKU Tracker

Archivo: `src/pages/InstagramConversations.tsx`

**Ruta:** `/instagram`
**Acceso desde el menú:** ítem "Instagram" en el header (icono de cámara con gradiente típico).

**Diseño:**

- Dos paneles (sidebar de conversaciones + chat) con layout responsive.
- En móvil alterna entre lista y chat con flecha de regreso.
- Refetch automático cada 15 segundos.

**Funcionalidad:**

- Lista de conversaciones ordenadas por `updated_at` descendente.
- Badge rosa **"Nuevo"** para conversaciones no leídas.
- Al abrir una conversación, se marca automáticamente como leída (`unread = false`).
- Si la conversación está enlazada a un lead, botón **"Ver lead"** que navega a `/leads/:id`.
- Si no está enlazada, botón **"Enlazar con lead"** (placeholder — funcionalidad pendiente).

---

## 8. Puntos de fricción durante la implementación

### 8.1 "Rol de desarrollador insuficiente" al añadir cuenta

El flujo "Inicio de sesión con Instagram" requiere que la cuenta de Instagram autorizadora tenga rol de tester. Esta opción no aparece visible en el panel nuevo de Meta.

**Solución:** se evitó este flujo cambiando a "Inicio de sesión con Facebook" + Graph API Explorer.

### 8.2 Permiso `pages_messaging` no aparecía

En la lista de permisos del caso de uso de Instagram, `pages_messaging` no estaba disponible.

**Solución:** agregar el caso de uso adicional **"Interactúa con los clientes en Messenger from Meta"**, que es el que trae los permisos de la familia Pages-Messaging.

### 8.3 Confusión de App Secret

Existen dos secretos:
- App Secret del App principal (`4495931967321788`)
- "Clave secreta de la aplicación de Instagram" del Instagram App ID (`836880116130054`)

**Conclusión:** la firma de los webhooks usa el **App Secret del App principal**.

### 8.4 Suscripción al campo `messages` falla con (#100)

Al enviar `subscribed_fields=message` (sin la s final), Meta lo rechaza con el listado de valores válidos.

**Solución:** debe ser **`messages`** (plural).

### 8.5 Webhook configurado pero los DMs reales no llegan

En modo desarrollo, Meta solo dispara webhooks de DMs cuando el **sender** es admin, developer o tester de la app a nivel de Facebook. Una cuenta personal de Instagram que no esté vinculada a una cuenta de Facebook con rol queda fuera.

**Estado:** documentado y pospuesto hasta el App Review.

---

## 9. Commits relevantes

```
b4cd0fd  feat: Instagram DM webhook (receive-only)
06859ce  feat: Instagram DMs conversations UI
```

(la migración de DB no quedó en git porque se aplicó vía MCP de Supabase)

---

## 10. Pendientes

### Bloqueante para producción

- **App Review de Meta.** Sin esto, los DMs solo llegan desde cuentas con rol en la app. Requiere:
  - Política de privacidad publicada en URL pública.
  - Video demo (~1-3 min) mostrando el flujo end-to-end.
  - Justificación escrita por cada permiso.
  - Credenciales de prueba para el revisor.
  - Cambiar la app de modo Desarrollo a Live.
  - Tiempo estimado: 3 días a 2 semanas.

### Mejoras planificadas

- **Enlazar conversación con lead existente** (botón actualmente solo muestra placeholder).
- **Crear lead nuevo desde una conversación** (para cuando el usuario manda DM por primera vez sin contacto previo).
- **Lookup de username** vía Instagram Graph API para mostrar `@usuario` en vez del ID.
- **Envío de respuestas** desde la UI usando `INSTAGRAM_PAGE_TOKEN` y el endpoint `POST /me/messages`.
- **Integración con Pablo** (asistente conversacional): adaptar el agente para responder DMs de Instagram igual que hace con WhatsApp.

### Renovación de tokens

El Page Access Token actual es de corta duración (~1-2 horas). Antes de pasar a producción:

1. Intercambiar el User Token corto por uno largo (60 días) vía:
   ```
   GET /v18.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-user-token}
   ```
2. Con el User Token largo, consultar `/me/accounts` para obtener un Page Token de duración indefinida.
3. Actualizar `INSTAGRAM_PAGE_TOKEN` en Supabase.
