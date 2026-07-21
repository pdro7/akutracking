# Pablo — asistente WhatsApp de AKUMAYA

> Este documento es el briefing operativo y técnico de Pablo. Está pensado para que un desarrollador (o una sesión Claude Code dedicada) pueda tomar el trabajo sobre Pablo sin explorar todo el repo.

## 0. Cómo usar este documento

Si eres una sesión Claude Code recién iniciada para trabajar Pablo:
- Lee este archivo completo antes de tocar código.
- Tu scope es **exclusivamente Pablo**: los tres edge functions listados abajo, el prompt canónico, y las páginas frontend relacionadas. **No** toques nada del CRM (leads, students, groups, payments, settings) sin confirmación explícita.
- Antes de cambiar el `SYSTEM_PROMPT` o el flujo de tools, consulta con el usuario — Pablo es un sistema en producción con historial de conversaciones reales.
- Los cambios a los edge functions se despliegan por MCP (`mcp__supabase__deploy_edge_function`) o por CLI de Supabase. Nada se aplica automáticamente al hacer commit.

---

## 1. Qué es Pablo

Asistente automático de WhatsApp para el negocio educativo AKUMAYA. Habla en español, tutea, usa emojis moderados, tono cálido y humano. **No** se presenta como IA salvo que el padre se dé cuenta y pregunte directamente.

### Jerarquía de objetivos

1. **Cerrar venta directa** (matrícula al curso). Pablo prioriza esto siempre.
2. **Agendar clase de prueba** — solo como fallback cuando el padre no cierra.
3. **Mantener la conversación abierta** — recolectar datos útiles del lead aunque no cierre en ese turno.

### Flujo comercial (9 pasos declarados en el prompt)

1. Saludo y presentación.
2. Calificación: edad del niño + ciudad.
3. Experiencia previa del niño con programación / robótica.
4. Recomendación: curso + precio + horario. Se apoya en la sección "FRANJAS DISPONIBLES ACTUALMENTE" inyectada dinámicamente al prompt (ver §5).
5. Cierre directo con link de pago Wompi + link Google Forms de inscripción.
6. Ofrecer clase de prueba **solo si** el padre no cerró en el paso 5.
7. Envío de información adicional (currículo, alcance).
8. Manejo de objeciones (precio, horario, distancia).
9. FAQ.

### Regla de oro

**Un mensaje suyo, un mensaje del padre.** Pablo nunca anticipa. Espera siempre respuesta antes del siguiente paso.

### Recomendaciones de curso por edad

- 7–10 años → **RCZ** (Real Coders Zero)
- 11–12 años → **RC1** o **MC1** (Minecraft Coders 1)
- 13+ años → **PGZ** (Python Zero)

### Precios (moneda COP, actualizados 2026)

| Programa | 1 cuota | 2 cuotas |
|---|---|---|
| Exploradores | $259.000 | $149.000 × 2 |
| Desarrolladores | $289.000 | $164.000 × 2 |
| Especialistas | $319.000 | $179.000 × 2 |

### Horarios base (sábados)

- 08:30
- 10:30
- 14:00

Adicionales entre semana pueden ser anunciadas si están activas en `course_slots`.

### Cuándo escala a humano

- El padre pide humano explícitamente ("quiero hablar con una persona").
- El padre lo confronta ("¿eres un bot?", "eres un robot").
- Detecta un tema fuera de alcance (queja formal, problema técnico grave, situación de sensibilidad emocional).

Al escalar, Pablo llama la tool `escalate_to_human`. Esto pone `whatsapp_conversations.escalated = true`. A partir de ahí:
- Los mensajes entrantes se **siguen guardando** en el hilo.
- Claude **no** se invoca.
- El humano responde manualmente desde `/conversations`.
- Cuando el humano desescala (botón en el chat), Pablo retoma en el próximo mensaje con todo el contexto previo.

---

## 2. Archivos que tocan Pablo

### Edge functions (backend)

```
supabase/functions/whatsapp-webhook/index.ts   ← cerebro
supabase/functions/start-conversation/index.ts ← outbound inicial con plantilla Twilio
supabase/functions/send-whatsapp/index.ts      ← respuesta manual del humano
```

### Prompt canónico

```
pablo-assistant-prompt.md   ← versión legible del prompt
```

El prompt real en producción está **hardcoded** dentro de `whatsapp-webhook/index.ts` como constante `SYSTEM_PROMPT`. El `.md` es la fuente de verdad conceptual, pero cambiar solo el `.md` no cambia el comportamiento — hay que sincronizar con el código y re-deployar.

### Frontend

```
src/pages/Conversations.tsx           ← bandeja tipo WhatsApp
src/pages/PabloStats.tsx              ← dashboard de métricas
src/pages/LeadDetail.tsx              ← botón "Iniciar con Pablo"
src/pages/InstagramConversations.tsx  ← bandeja de IG (mismo modelo, otro canal)
```

### Base de datos

```
whatsapp_conversations   ← tabla principal
lead_notes               ← Pablo escribe notas aquí vía tool add_note
leads                    ← Pablo crea/actualiza vía tool register_lead
course_slots             ← inyectado al prompt en runtime
```

---

## 3. Arquitectura

### Ruta de un mensaje entrante

```
Padre en WhatsApp
    │
    ▼
Twilio (recibe SMS/WA)
    │  POST con TwiML XML
    ▼
edge function whatsapp-webhook
    │
    ├─ 1. Parseo del From (whatsapp:+57...) y Body
    ├─ 2. Detecta modo especial "Nuevo LID" si From = AKU_INTERNAL_NUMBER
    │       y Body contiene "nuevo lid/lead" → usa EXTRACTION_SYSTEM_PROMPT
    ├─ 3. Descarga imágenes si NumMedia > 0
    │       → sube a Supabase Storage bucket "whatsapp-media"
    │       → guarda URL permanente en el mensaje
    │       → base64 solo para la llamada actual a Claude (vision)
    ├─ 4. Busca/crea whatsapp_conversations por phone
    ├─ 5. Push del mensaje entrante al array messages (jsonb)
    ├─ 6. Si conversation.escalated = true → END (guardar y responder <Response/>)
    ├─ 7. Construir prompt dinámico:
    │       - SYSTEM_PROMPT base
    │       - + sección "FRANJAS DISPONIBLES ACTUALMENTE" desde course_slots activos
    │       - + últimos MAX_HISTORY_MESSAGES (40) del hilo como mensajes user/assistant
    ├─ 8. anthropic.messages.create({
    │       model: claude-haiku-4-5-20251001,
    │       max_tokens: 1024,
    │       tools: [register_lead, add_note, escalate_to_human],
    │       messages: [...],
    │       system: prompt_dinamico
    │    })
    ├─ 9. Procesar tool_use en respuesta (si hay):
    │       - register_lead → INSERT/UPDATE leads (source='whatsapp')
    │       - add_note → INSERT lead_notes
    │       - escalate_to_human → UPDATE whatsapp_conversations SET escalated=true
    ├─ 10. Extraer text response, convertir a formato WhatsApp:
    │       - **bold** → *bold*
    │       - # Header → HEADER MAYÚSCULAS
    │       - - lista → • lista
    ├─ 11. Push del mensaje del asistente al array messages
    ▼
Response TwiML: <Response><Message>...</Message></Response>
    │
    ▼
Twilio envía el mensaje al padre
```

### Outbound inicial (`start-conversation`)

```
Botón "Iniciar con Pablo" en LeadDetail
    │
    ▼
supabase.functions.invoke('start-conversation', { lead_id })
    │
    ▼
edge function start-conversation
    │
    ├─ 1. Fetch lead + parent_name + phone
    ├─ 2. Twilio Content API con TWILIO_TEMPLATE_SID (plantilla aprobada)
    │      con variable {parent_name}
    ├─ 3. Crear whatsapp_conversations con el mensaje inicial
    ├─ 4. UPDATE lead SET status='contacted'
    ▼
Padre recibe el primer mensaje de Pablo
```

Es necesaria una **plantilla Twilio aprobada** porque WhatsApp Business no permite iniciar conversaciones fuera de la ventana de 24h con texto libre.

### Respuesta manual (`send-whatsapp`)

```
Humano escribe en /conversations mientras conversation.escalated=true
    │
    ▼
send-whatsapp edge function
    │
    ├─ 1. Twilio API POST con From=TWILIO_WHATSAPP_FROM, To=phone, Body
    ├─ 2. Push del mensaje al array messages con role='assistant'
    ▼
Padre recibe la respuesta como si viniera del "mismo Pablo"
```

---

## 4. Modelo de datos

### Tabla `whatsapp_conversations`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `phone` | text | Identificador de la conversación. Formato Twilio: `whatsapp:+573001234567`. |
| `messages` | jsonb | Array de mensajes. Ver formato abajo. |
| `lead_id` | uuid FK | Se llena cuando Pablo ejecuta `register_lead`. |
| `student_id` | uuid FK | Se llena si el contacto ya es alumno. |
| `escalated` | boolean | Si true, Pablo no responde automáticamente. |
| `status` | text | Estado (`open`, `closed`, etc.). |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Formato de un mensaje en `messages`

```json
{
  "role": "user" | "assistant",
  "content": "texto del mensaje",
  "timestamp": "2026-07-16T15:23:00Z",
  "image_url": "https://.../whatsapp-media/xyz.jpg"   // opcional
}
```

`role: "user"` = mensaje entrante del padre. `role: "assistant"` = mensaje saliente (Pablo o humano en modo escalado).

### Historial que ve Pablo

Cap `MAX_HISTORY_MESSAGES = 40`. Solo los últimos 40 se pasan a Claude como contexto — antes se olvida.

### Storage bucket `whatsapp-media`

- Bucket público de Supabase Storage.
- Imágenes descargadas de Twilio se suben aquí para tener URL permanente.
- La URL queda en `messages[i].image_url`.
- El base64 se calcula al vuelo solo para la llamada a Claude cuando el mensaje es reciente y el modelo necesita vision.

---

## 5. Prompt dinámico

El `SYSTEM_PROMPT` base está en el código. En cada request, la función:

1. Query a `course_slots` con `is_active = true` (join con `virtual_courses` para el nombre).
2. Formatea una sección tipo:

```
FRANJAS DISPONIBLES ACTUALMENTE:
- RC1 (Real Coders 1): Sábados 10:30, inicia 2026-07-27
- MC1 (Minecraft Coders 1): Sábados 14:00, inicia 2026-08-03
```

3. La concatena al `SYSTEM_PROMPT` base antes de llamar a Claude.

**Si no hay franjas activas**, Pablo pregunta la disponibilidad del padre y la guarda con la tool `add_note`. No inventa horarios.

---

## 6. Variables de entorno

Configuradas en Supabase Dashboard → Edge Functions → Settings.

| Variable | Requerido | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | Claude API. Sin esto Pablo no responde. |
| `TWILIO_ACCOUNT_SID` | Recomendado | Para descargar media entrantes con auth. |
| `TWILIO_AUTH_TOKEN` | Recomendado | Igual. |
| `TWILIO_WHATSAPP_FROM` | Sí (para send-whatsapp) | Número WhatsApp Business. |
| `TWILIO_TEMPLATE_SID` | Sí (para start-conversation) | Plantilla aprobada para outbound inicial. |
| `AKU_INTERNAL_NUMBER` | Opcional | Si viene un mensaje de este número con "nuevo lid", activa modo extracción. |
| `SUPABASE_URL` | Auto | Inyectado por Supabase Edge. |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Inyectado. |
| `SUPABASE_ANON_KEY` | Auto | Inyectado. |

---

## 7. Herramientas (tools) disponibles para Claude

Pablo tiene tres herramientas expuestas vía `tool_use`:

### `register_lead`

Crea o actualiza un lead. Se usa cuando Pablo ya recolectó datos suficientes (nombre del niño, edad, ciudad).

**Input schema:**
```json
{
  "child_name": "string",
  "parent_name": "string",
  "age": "string (opcional)",
  "city": "string (opcional)",
  "course_interest": "string (opcional)",
  "trial_class_date": "YYYY-MM-DD (opcional)"
}
```

**Efectos:**
- Si ya existe lead con ese `phone` (extraído de la conversación) → UPDATE.
- Si no → INSERT con `source='whatsapp'`, `status='new'` o `contacted`.
- Vincula la conversación al lead (`whatsapp_conversations.lead_id`).

### `add_note`

Añade una nota al lead ya vinculado. Se usa para dejar rastro de datos que no caben en el schema del lead (preferencias particulares, contexto del niño, objeciones).

**Input:**
```json
{ "content": "string" }
```

**Efecto:** INSERT en `lead_notes` con `lead_id` de la conversación.

### `escalate_to_human`

Marca la conversación como escalada.

**Input:**
```json
{ "reason": "string" }
```

**Efecto:** UPDATE `whatsapp_conversations SET escalated = true`. La razón queda en el hilo como mensaje del asistente antes de escalar.

---

## 8. Modos especiales

### Modo extracción "Nuevo LID"

Cuando el WhatsApp del **equipo interno de AKU** reenvía un screenshot de otro chat/aplicación a Pablo (para "importar" ese contacto), Pablo cambia de modo.

**Trigger:**
- `From` del webhook coincide con `AKU_INTERNAL_NUMBER`.
- `Body` contiene la palabra "nuevo lid" (o "nuevo lead", case-insensitive).

**Comportamiento:**
- Cambia el `system prompt` a `EXTRACTION_SYSTEM_PROMPT` (también hardcoded en el edge function).
- No usa historial de conversación — es un one-shot.
- Analiza la imagen adjunta (vision), extrae los datos del contacto.
- Ejecuta `register_lead` con lo que encuentra.
- Responde al equipo con un resumen ("Lead creado: [nombre], [teléfono], [curso]").

Útil para forwardear conversaciones que llegan al WhatsApp humano de AKUMAYA sin abrir la app.

---

## 9. Frontend

### `/conversations` (`Conversations.tsx`)

Bandeja tipo WhatsApp. Lista de conversaciones con búsqueda (por nombre padre/niño, teléfono principal, teléfonos adicionales). Panel derecho con el hilo activo.

**Elementos:**
- Timestamps por mensaje y separador visual por día ("Hoy", "Ayer", fecha completa).
- Botón para escalar/desescalar en la cabecera del chat.
- Input al fondo para respuesta manual (dispara `send-whatsapp`).
- Refetch en background cada 5s vía React Query (`refetchInterval`).

### `/pablo-stats` (`PabloStats.tsx`)

Dashboard de métricas.

**Widgets:**
- KPIs: conversaciones totales, conversaciones activas, tasa de escalación, leads creados por Pablo.
- Funnel: contactado → interesado → trial agendado → inscrito.
- LineChart: conversaciones por día.
- BarChart: distribución de mensajes por hora del día.

**Filtros:** 7 días, 30 días, 90 días, todo.

### Botón "Iniciar con Pablo" en `LeadDetail.tsx`

Visible cuando:
- El lead no tiene ya una conversación WhatsApp asociada.
- El lead no está `enrolled`.

Al pulsar → llama `start-conversation` edge function.

---

## 10. Estado actual (2026-07-16)

**Pablo está desplegado y funcional pero no en uso operativo.**

- Los leads reales de AKUMAYA siguen entrando por el número WhatsApp principal, gestionado manualmente.
- Pablo vive en un número Twilio distinto que no recibe tráfico orgánico.
- El código está mantenido y funcionando — no hay bugs conocidos.
- La razón práctica para no activarlo: falta decisión de negocio sobre migrar el volumen al número de Pablo, y falta calibración del prompt con casos reales.

### Trabajo pendiente para activación

- Decisión estratégica: usar el mismo número principal o mantener separación.
- Calibración del prompt con casos reales del último trimestre.
- Seguimiento tardío: si el padre no responde en 24h, Pablo debería reintentar con un mensaje suave (roadmap, no implementado).
- Inyectar `virtual_courses.curriculum` al prompt para respuestas más precisas por curso (roadmap, no implementado — la columna ni siquiera existe aún).

---

## 11. Cómo hacer cambios

### Cambiar el prompt

1. Edita el `SYSTEM_PROMPT` (o `EXTRACTION_SYSTEM_PROMPT`) en `supabase/functions/whatsapp-webhook/index.ts`.
2. Sincroniza el cambio conceptualmente en `pablo-assistant-prompt.md`.
3. Redeploy la edge function. Vía MCP:
   ```
   mcp__supabase__deploy_edge_function con name="whatsapp-webhook"
   ```
   Vía CLI:
   ```bash
   supabase functions deploy whatsapp-webhook
   ```
4. **Prueba enviando un mensaje real al número Twilio de Pablo.** No hay tests automáticos.
5. Verifica en `whatsapp_conversations` que el mensaje entrante y la respuesta se guardaron correctamente.

### Añadir una nueva tool

1. Añade la definición al array `tools` en `whatsapp-webhook/index.ts`.
2. Añade el handler de `tool_use` en el loop de procesamiento de la respuesta de Claude.
3. Documenta la tool en el `SYSTEM_PROMPT` (Claude necesita saber cuándo usarla, no solo su schema).
4. Redeploy.
5. Prueba en un hilo real que Claude la invoca cuando corresponde.

### Cambiar el modelo Claude

Buscar `claude-haiku-4-5-20251001` en `whatsapp-webhook/index.ts`. Cambiar por el ID del modelo nuevo.

**Antes de subir de tier** (Haiku → Sonnet): considera costo. Pablo procesa ~1 llamada por mensaje entrante y las conversaciones típicas tienen 15–30 mensajes. Sonnet 4.6 cuesta ~3× más que Haiku 4.5 para la misma tarea.

### Cambiar el catálogo de tools o el modelo

`max_tokens` está en 1024. Si el prompt crece y las respuestas se cortan, subir a 2048. No subas más — las respuestas de Pablo deben ser cortas (WhatsApp).

---

## 12. Debugging

### Pablo no responde a un mensaje

1. Revisa logs del edge function:
   ```
   mcp__supabase__get_logs con service="edge-function"
   ```
2. Verifica que la conversación no esté `escalated=true`:
   ```sql
   SELECT phone, escalated, status FROM whatsapp_conversations
   WHERE phone LIKE '%573...' ORDER BY updated_at DESC LIMIT 1;
   ```
3. Verifica que `ANTHROPIC_API_KEY` esté configurada en Edge Functions Settings.
4. Verifica que Twilio esté apuntando el webhook a la URL correcta:
   `https://kmjordmkybqvihcgosct.supabase.co/functions/v1/whatsapp-webhook`

### Pablo respondió pero no llegó al padre

1. Revisa logs de Twilio (dashboard Twilio → Messaging → Logs).
2. Verifica que el número Twilio tiene saldo y la plantilla de WhatsApp Business sigue aprobada.
3. Confirma que `From` en TwiML no chocó con formato incorrecto.

### Pablo respondió algo raro / desalineado del prompt

1. Copia el `messages` array desde `whatsapp_conversations` (últimos 40).
2. Reprodúcelo en la API de Anthropic directamente con el mismo prompt.
3. Si el problema es reproducible → ajustar prompt. Si no → puede ser deriva del modelo; considerar subir la temperatura a 0 (por defecto ya lo está en el código).

### El botón "Iniciar con Pablo" da error

1. Revisa logs del edge function `start-conversation`.
2. Verifica que `TWILIO_TEMPLATE_SID` esté configurado y la plantilla siga aprobada por Meta.
3. Verifica que el número `TWILIO_WHATSAPP_FROM` esté vigente.

### Se dispararon respuestas duplicadas

Twilio reintenta el webhook si no recibe 200 en cierto tiempo. Si el edge function tarda mucho procesando (>10s por llamada a Claude), Twilio reintenta. Solución: idempotencia por `MessageSid` de Twilio — revisar si ya está implementado antes de añadirlo (no lo he verificado en el código).

---

## 13. Checklist antes de deployar cambios grandes

- [ ] Cambio local visible en `git diff supabase/functions/whatsapp-webhook/index.ts`.
- [ ] `pablo-assistant-prompt.md` actualizado si cambió el prompt.
- [ ] Redeploy vía MCP o CLI ejecutado.
- [ ] Prueba manual: mensaje real de prueba al número Twilio.
- [ ] Verificación del hilo en `/conversations` (mensaje entrante + respuesta guardados).
- [ ] Si se añadió tool: probar que Claude la invoca en el caso esperado.
- [ ] Si se cambió el flujo comercial: probar el flujo completo (saludo → recomendación → cierre).
- [ ] Confirmar con el usuario antes de commit + push. El repo no auto-deploya edge functions — el deploy es manual e independiente.

---

## 14. Roadmap Pablo

Consolidado desde `docs/roadmap.md` (fuente de verdad del negocio) + sugerencias adicionales técnicas.

### Desde el roadmap oficial

**Pablo — mejoras pendientes** (roadmap §Pablo)

- [ ] **Seguimiento automático de conversaciones sin respuesta.** Job programado que detecta leads/ex-alumnos sin respuesta en X días y Pablo les envía un mensaje de seguimiento automáticamente. Requiere cron y plantilla Twilio aprobada específica.
- [ ] **Plantillas adicionales de WhatsApp.** Follow-up para leads fríos, recordatorio de clase de prueba, mensaje post-prueba. Cada una necesita aprobación por Meta/Twilio.
- [ ] **Actualizar Google Apps Script de Calendly** para insertar en `leads` en lugar de `trial_leads` (esta tabla ya no existe tras el refactor del 2026-05-05).

**Base de conocimiento de cursos** (roadmap §Base de conocimiento — impacta directamente a Pablo)

- [ ] Añadir campos `curriculum` (resumen corto) y `program_url` (PDF) a `virtual_courses`.
- [ ] Inyectar descripción + curriculum en el prompt de Pablo dinámicamente (junto a la sección de franjas activas).
- [ ] Pablo comparte el link al PDF cuando un padre pide el temario detallado.

**Reactivación de ex-alumnos** (roadmap §Reactivación — Pablo es el canal)

- [ ] Flujo de reactivación desde `students` activos que llevan tiempo sin renovar pack (no solo ex-alumnos importados).
- [ ] Mensaje de plantilla específico para reactivación (diferente al de captación de leads nuevos).

### Sugerencias adicionales (no en el roadmap oficial — validar antes de trabajar)

- [ ] **Extracción de objeciones estructuradas.** Cuando Pablo detecta objeción, en vez de solo escribir nota libre, mapear a categorías (`precio`, `horario`, `edad`, `distancia`, `otro`) para reportes agregados en `PabloStats`.
- [ ] **Métricas de conversión atribuidas a Pablo.** Ampliar `PabloStats` con: cuántos leads que hablaron con Pablo terminaron en `enrolled`, tiempo medio de la conversación hasta cierre, tasa de escalación por hora del día.
- [ ] **Handoff explícito al escalar.** Notificar al humano por otro canal (email, Slack) cuando una conversación se escala, para reducir el tiempo hasta primera respuesta manual.
- [ ] **Modo silencioso post-enrollment.** Detectar que el lead ya está `enrolled` (o la conversación tiene `student_id`) y cambiar a un prompt de soporte, no de venta.
- [ ] **Idempotencia por `MessageSid` de Twilio.** Verificar si ya existe protección contra reintentos duplicados de webhook. Si no, añadirla.

---

## 15. Recursos externos referidos

- Prompt canónico legible: [`pablo-assistant-prompt.md`](../pablo-assistant-prompt.md)
- Documento operativo general de la plataforma: `~/Documents/AKU/guia-akutracker.html` (fuera del repo).
- URL producción edge function: `https://kmjordmkybqvihcgosct.supabase.co/functions/v1/whatsapp-webhook`
- Wompi checkout usado en cierres: `https://checkout.wompi.co/l/AZ9CzW`
- Formulario Google Forms post-pago: `https://forms.gle/UyqpPYgmZKr9dY2s9`
