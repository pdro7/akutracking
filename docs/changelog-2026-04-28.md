# Changelog — 2026-04-28

## Outbound: Pablo inicia conversaciones desde el CRM

### Template de WhatsApp
- Creado y aprobado template `aku_hola` en Twilio para mensajes outbound
- Texto del template: *"Hola {{1}} 👋 Soy Pablo, asistente virtual de AKUMAYA Educación 🤖 Para poder darte información más detallada, cuéntame: ¿qué edad tiene tu hijo/a y en qué ciudad se encuentran? 😊"*
- Presenta a Pablo explícitamente como asistente virtual (transparencia con el padre)
- `{{1}}` se sustituye por el nombre del padre/madre al enviar

### Nueva Edge Function `start-conversation`
- Recibe un `lead_id`, obtiene el teléfono y nombre del padre desde la BD
- Envía el template aprobado vía Twilio API
- Crea el registro de conversación en `whatsapp_conversations` vinculado al lead
- Mueve el lead automáticamente de **Nuevo → Contactado**
- Normaliza números colombianos (10 dígitos que empiezan por 3 → añade prefijo `+57`)
- Normaliza el prefijo `whatsapp:` del número origen independientemente de cómo esté guardado el secret

### Botón "Iniciar con Pablo" en la UI
- Aparece en cada fila de la tabla de Leads con estado **Nuevo**
- Aparece en el header del detalle de un lead cuando aún no tiene conversación activa
- Botón verde, se deshabilita mientras procesa para evitar doble envío
- Al completarse, el lead pasa a **Contactado** y la conversación queda visible en la sección Pablo

## Correcciones al comportamiento de Pablo

### Registro silencioso de leads
- Pablo anunciaba "Déjame registrar a Zoe en nuestro sistema", lo que interrumpía el flujo porque el padre respondía "Ok" y Pablo se quedaba sin saber qué preguntar
- Ahora el registro ocurre de forma invisible: Pablo llama la herramienta internamente y continúa inmediatamente con la siguiente pregunta del flujo
- Regla añadida al prompt en dos lugares: sección REGISTRO DE LEAD y regla 10 de REGLAS IMPORTANTES

## Correcciones técnicas
- `TWILIO_WHATSAPP_FROM` ahora se normaliza en código — el secret puede guardarse con o sin el prefijo `whatsapp:` y funciona igual
- Los errores de Twilio ahora llegan visibles en el toast del CRM en lugar del genérico "non-2xx status code"
