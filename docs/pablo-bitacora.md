# Pablo — Bitácora de sesiones presenciales (diseño)

> Documento de **diseño**, no de implementación. Describe cómo extender Pablo para
> registrar, por audio del profesor, lo que hizo cada niño al final de cada sesión
> presencial (sábados en la sede), y construir un historial de proyectos por alumno
> para evitar repetirlos. **Nada de esto está implementado todavía.**

Relacionado: [`pablo.md`](./pablo.md) (briefing operativo de Pablo).

---

## 0. Objetivo

Cada sábado, al terminar la sesión presencial, el profesor envía **un audio de WhatsApp**
al número de Pablo describiendo, niño por niño, qué proyecto/actividad hizo. Pablo:

1. Transcribe el audio.
2. Extrae la información estructurada por cada niño.
3. La empareja con el alumno correcto del CRM.
4. La guarda en un historial persistente (`student_activity_log`).
5. Responde al profesor con un resumen para que confirme o corrija.

Objetivo de negocio: tener un **historial de proyectos por alumno** consultable, para
**no repetir proyectos** en sesiones futuras y para dar continuidad pedagógica.

### No-objetivos (por ahora)

- No es un sistema de asistencia ni de calificaciones.
- No sustituye ningún registro académico formal.
- No procesa video ni documentos, solo audio (y como fallback, texto).

---

## 1. Verdict de viabilidad

- ✅ Reutiliza el patrón "modo interno" que Pablo ya tiene (`AKU_INTERNAL_NUMBER` +
  palabra clave → cambia de system prompt). Ver `whatsapp-webhook/index.ts` modo
  "Nuevo LID".
- ✅ Reutiliza la descarga autenticada de media de Twilio (hoy usada para imágenes).
- ✅ Reutiliza el patrón `tool_use` para escribir en BD.
- ⚠️ **Único bloqueante nuevo:** Claude **no acepta audio** en la API de mensajes (solo
  texto e imágenes). Hay que añadir un paso de **speech-to-text (STT)** antes de llamar
  a Claude. Hoy el webhook, ante un audio, solo guarda el texto `[Audio adjunto: url]`
  (`whatsapp-webhook/index.ts`, rama `mediaType.startsWith('audio/')`).

El 80% del riesgo está en dos puntos: (a) elegir e integrar el proveedor de
transcripción, y (b) emparejar de forma fiable los nombres hablados con los alumnos.

---

## 2. Scope y relación con el CRM

| Pieza | Dominio | Quién la toca |
|---|---|---|
| Nuevo modo en `whatsapp-webhook` (routing, STT, extracción, tool) | **Pablo** | Sesión Pablo |
| Prompts nuevos (`SESSION_LOG_SYSTEM_PROMPT`, lectura) | **Pablo** | Sesión Pablo |
| Tool `log_student_activity` | **Pablo** | Sesión Pablo |
| Tabla `student_activity_log` | **CRM / students** | Coordinar con sesión CRM |
| Vista de bitácora en detalle del alumno | **CRM / students** | Coordinar con sesión CRM |
| Lista de teléfonos de profesores autorizados | Compartido | Coordinar |

**Regla:** el backend de Pablo es terreno propio; la tabla nueva y cualquier UI en el
detalle del alumno se coordinan con la sesión del CRM antes de crear esquema o pantallas.

---

## 3. Arquitectura — modo escritura (registrar sesión)

```
Profesor en la sede (sábado, fin de sesión)
    │  audio de WhatsApp al número de Pablo
    ▼
Twilio → POST webhook (NumMedia=1, MediaContentType0=audio/ogg)
    │
    ▼
edge function whatsapp-webhook
    │
    ├─ 1. Parseo From/Body/Media (igual que hoy)
    ├─ 2. ¿From ∈ profesores autorizados?  (y opcional: Body contiene "bitácora"/"cierre")
    │       └─ NO  → flujo normal de Pablo (ventas)
    │       └─ SÍ  → MODO BITÁCORA
    │
    ├─ 3. Descargar el audio de Twilio (Basic Auth, ya se hace para imágenes)
    ├─ 4. STT: enviar bytes del .ogg al proveedor → transcript en español
    ├─ 5. Resolver el grupo/roster:
    │       - identificar al profesor por su teléfono
    │       - obtener los alumnos candidatos (roster del/los grupo(s) presenciales
    │         del profesor) → inyectar nombres + student_id al prompt
    ├─ 6. Claude (Haiku 4.5) con SESSION_LOG_SYSTEM_PROMPT:
    │       - input: transcript + roster
    │       - output: una llamada a log_student_activity por cada niño reconocido
    ├─ 7. Procesar tool_use:
    │       - por cada log_student_activity → INSERT en student_activity_log
    │       - acumular niños no emparejados
    ├─ 8. Responder al profe con resumen + niños no reconocidos para confirmación
    ▼
Response TwiML con el resumen
```

Notas:

- El modo bitácora, como el modo "Nuevo LID", puede ser **one-shot** (sin historial de
  conversación) o mantener un mini-estado para el ciclo de corrección (ver §7).
- La sesión (`session_date`) se toma de la fecha del webhook; si el profe manda el audio
  el domingo, se puede permitir que lo diga en el audio ("la clase de ayer").

---

## 4. Transcripción (STT) — la pieza nueva

### Por qué es necesaria

La API de Anthropic (`/v1/messages`) acepta bloques de texto e imagen, **no audio**. Por
tanto hay que transcribir el audio a texto antes de llamar a Claude.

### Opciones de proveedor

| Proveedor | Modelo | Español | Formato `.ogg`/opus de WhatsApp | Notas |
|---|---|---|---|---|
| OpenAI | `whisper-1` / `gpt-4o-transcribe` | Muy bueno | Soportado (`ogg`) | Barato, simple, 1 request |
| Deepgram | `nova-2` | Muy bueno | Soportado | Streaming, buen precio |
| Google | Speech-to-Text | Bueno | Requiere config de encoding | Más setup |

**Recomendación inicial:** OpenAI Whisper (`whisper-1`) por simplicidad y calidad en
español. WhatsApp entrega audios en `audio/ogg; codecs=opus`, que Whisper acepta.

### Consideraciones

- **Coste:** ~1 audio por grupo por sábado ⇒ despreciable.
- **Nueva variable de entorno:** `OPENAI_API_KEY` (o la del proveedor elegido) en los
  secrets del edge function.
- **Latencia:** transcribir añade segundos al request. Twilio reintenta si el webhook
  no responde ~10s (ver §8, idempotencia). Si se vuelve un problema, mover el trabajo a
  procesamiento asíncrono (responder 200 rápido y procesar en background).
- **Idioma:** fijar `language=es` para mejorar precisión.

---

## 5. Detección de modo y remitentes autorizados

Hoy existe un único `AKU_INTERNAL_NUMBER`. Para varios profesores hay dos caminos:

1. **Simple:** variable de entorno con lista de números separados por coma
   (`AKU_TEACHER_PHONES`). Suficiente para arrancar.
2. **Robusto:** tabla `staff_phones (phone, staff_name, role)` o reutilizar el registro
   de profesores existente. Permite además **identificar al profesor** (útil para §6).

**Trigger del modo bitácora** (a decidir):

- Solo por remitente (cualquier audio de un profe autorizado entra en modo bitácora), **o**
- Remitente **+** palabra clave en el `Body` o en el propio audio (p. ej. "cierre",
  "bitácora"), para no confundir con otros mensajes internos.

Recomendación: remitente autorizado **+** que traiga audio ⇒ modo bitácora. La palabra
clave queda como refuerzo opcional.

---

## 6. Emparejamiento de nombres (lo más frágil)

El profesor dice nombres hablados ("Juan", "Ale", "el nuevo"). Hay que mapearlos a
`student_id` reales. Estrategia:

1. **Acotar candidatos:** identificar al profesor por su teléfono ⇒ obtener el/los
   grupo(s) presencial(es) que dicta ⇒ roster de esos grupos. Cuantos menos candidatos,
   menos ambigüedad.
2. **Inyectar el roster al prompt:** pasar a Claude la lista `[{student_id, nombre}]` de
   candidatos. Claude hace el emparejamiento difuso (apodos, nombre incompleto) y
   devuelve el `student_id`.
3. **Nunca inventar:** si un nombre no está en el roster, Claude **no** lo empareja; lo
   marca como "no reconocido" y Pablo lo reporta al profe.
4. **Red de seguridad:** el paso de confirmación (§7) permite al profe corregir antes de
   que quede en firme.

Casos difíciles a contemplar: homónimos (dos "Juan"), audio ruidoso, un niño invitado que
no está en el roster, niño que faltó y el profe no lo menciona.

**Pregunta abierta:** ¿existe ya un mapeo profesor ↔ grupo presencial en el CRM? (Hay
calendarios de disponibilidad de profesores, así que probablemente sí.) Si no, el profe
tendría que indicar el grupo, o se buscaría en todos los alumnos presenciales (más
ambiguo).

---

## 7. Tool nueva: `log_student_activity`

Una llamada por niño reconocido. Schema propuesto:

```json
{
  "name": "log_student_activity",
  "description": "Registra lo que un alumno hizo en una sesión presencial. Llamar una vez por cada niño mencionado y reconocido en el roster.",
  "input_schema": {
    "type": "object",
    "properties": {
      "student_id":   { "type": "string", "description": "ID del alumno del roster inyectado. NUNCA inventar." },
      "session_date": { "type": "string", "description": "Fecha de la sesión YYYY-MM-DD" },
      "project":      { "type": "string", "description": "Nombre/título del proyecto trabajado" },
      "activity_summary": { "type": "string", "description": "Qué hizo el niño, en 1-2 frases" },
      "tech_used":    { "type": "string", "description": "Herramienta/lenguaje (Scratch, Python, Minecraft...) (opcional)" },
      "notes":        { "type": "string", "description": "Observaciones del profe (avance, dificultad, comportamiento) (opcional)" }
    },
    "required": ["student_id", "session_date", "activity_summary"]
  }
}
```

Para los niños **no emparejados**, no se llama la tool: Claude los lista en su respuesta de
texto para que el profe confirme/corrija.

---

## 8. Modelo de datos

### Tabla nueva `student_activity_log` (dominio CRM — coordinar)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `student_id` | uuid FK → students | Alumno |
| `session_date` | date | Fecha de la sesión |
| `project` | text | Título del proyecto (nullable) |
| `activity_summary` | text | Qué hizo |
| `tech_used` | text | Herramienta/lenguaje (nullable) |
| `notes` | text | Observaciones (nullable) |
| `source` | text | `whatsapp_audio` \| `manual` |
| `recorded_by` | text/uuid | Profesor que reportó (nullable) |
| `raw_transcript` | text | Transcript completo del audio (auditoría/depuración, nullable) |
| `created_at` | timestamptz | |

Índices sugeridos: `(student_id, session_date)` para consultar el historial de un alumno.

Guardar `raw_transcript` (al menos temporalmente) ayuda a depurar emparejamientos y a
recuperar info si la extracción falló.

---

## 9. Confirmación y corrección

El modo interno actual es one-shot (sin memoria). Para el ciclo "registra → confirma →
corrige" hay dos diseños:

- **A. Escribir directo + corrección posterior.** Se insertan las filas de una, Pablo
  responde el resumen, y si el profe corrige ("Juan no, era Julián"), un segundo mensaje
  edita/borra. Requiere mantener algo de contexto del último registro.
- **B. Staging pendiente.** Se guarda en estado "pendiente de confirmación"; solo al
  "sí" del profe se consolida. Más limpio, pero necesita estado entre mensajes.

Recomendación para v1: **A** (más simple), aceptando que la corrección es un mensaje
extra. Migrar a **B** si la precisión del emparejamiento resulta baja.

Ejemplo de respuesta de Pablo:

```
Listo, registré la sesión del 26/07:
• Juan Pérez → laberinto en Scratch
• Alejandro Arévalo → juego de plataformas en Python
⚠️ No reconocí a "Santi" en este grupo. ¿Quién es o de qué grupo?
```

---

## 10. Modo lectura — consultar historial

Para cumplir el objetivo ("no repetir proyectos"), el historial debe ser consultable.

### Opción A — por WhatsApp (barato)

Otro sub-modo interno de solo lectura. El profe escribe *"¿qué ha hecho Alejandro?"* y
Pablo responde con la lista de proyectos pasados (query a `student_activity_log`). Útil
sobre la marcha, pero limitado para planear.

### Opción B — en la app (mejor UX, dominio CRM)

Una sección "Bitácora / proyectos" en el detalle del alumno que liste las sesiones
(fecha, proyecto, tech, notas). Ideal para que el profe planee la siguiente clase sin
repetir. Requiere coordinación con la sesión CRM.

Ambas no son excluyentes; A es casi gratis, B aporta el mayor valor.

---

## 11. Idempotencia

La transcripción + varias escrituras hacen el request más lento. Twilio reintenta el
webhook si no recibe 200 a tiempo, lo que podría **duplicar** el registro. Antes de
lanzar esto conviene deduplicar por el `MessageSid` de Twilio (registrar los SID ya
procesados y descartar repetidos). Este riesgo ya se menciona en `pablo.md` §12 para el
flujo de ventas; aquí es más agudo por la latencia añadida.

---

## 12. Variables de entorno nuevas

| Variable | Uso |
|---|---|
| `OPENAI_API_KEY` (o la del STT elegido) | Transcripción del audio |
| `AKU_TEACHER_PHONES` | Lista de teléfonos de profes autorizados (si no se usa tabla) |

---

## 13. Preguntas abiertas (decidir antes de implementar)

1. **Proveedor de STT:** ¿OpenAI Whisper u otro? ¿Hay cuenta OpenAI disponible?
2. **Mapeo profesor ↔ grupo presencial:** ¿ya existe en el CRM? Determina la calidad del
   emparejamiento de nombres.
3. **Trigger del modo:** ¿solo por remitente, o remitente + palabra clave?
4. **Confirmación:** ¿escribir directo (A) o staging pendiente (B)?
5. **Lectura:** ¿WhatsApp, app, o ambas? ¿La vista en app entra en este alcance o después?
6. **Multi-grupo:** si un profe dicta varios grupos el mismo sábado, ¿cómo se distingue?
   ¿Lo dice en el audio o se pregunta?

---

## 14. Plan de implementación por fases (borrador)

1. **Fase 0 — decisiones.** Cerrar las preguntas de §13. Coordinar tabla con sesión CRM.
2. **Fase 1 — infraestructura STT.** Integrar transcripción y probarla con audios reales
   de WhatsApp (formato ogg/opus, español).
3. **Fase 2 — tabla + tool.** Crear `student_activity_log` (coordinado) y la tool
   `log_student_activity`.
4. **Fase 3 — modo bitácora.** Routing por profesor, prompt nuevo, inyección de roster,
   extracción, escritura, respuesta-resumen.
5. **Fase 4 — idempotencia.** Dedupe por `MessageSid`.
6. **Fase 5 — lectura.** Sub-modo WhatsApp y/o vista en detalle del alumno (CRM).
7. **Fase 6 — piloto.** Un profesor, un grupo, unas semanas. Medir precisión del
   emparejamiento antes de extender.

---

## 15. Checklist previo a implementar

- [ ] Preguntas de §13 resueltas y confirmadas con el usuario.
- [ ] Proveedor STT elegido y API key disponible.
- [ ] Esquema de `student_activity_log` acordado con la sesión CRM.
- [ ] Fuente del roster (mapeo profesor↔grupo) confirmada.
- [ ] Estrategia de confirmación (A o B) decidida.
- [ ] Plan de prueba con audio real definido (no hay tests automáticos en Pablo).
