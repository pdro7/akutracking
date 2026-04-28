# Changelog — 2026-04-27

## Pablo · Conversaciones (nueva sección)

### Interfaz tipo WhatsApp
- Nueva página `/conversations` accesible desde el menú principal ("Pablo")
- Panel izquierdo con lista de todas las conversaciones: nombre del contacto, teléfono, preview del último mensaje y tiempo transcurrido
- Panel derecho con el hilo completo de mensajes en el mismo estilo visual que la vista de detalle de lead (burbujas primarias para Pablo, fondo muted para el padre)
- Botón "Ver lead" en el header del chat para navegar directamente al lead vinculado
- Auto-refresco cada 15 segundos para ver nuevos mensajes sin recargar

## Sistema de escalación y control manual

### Intervención humana en conversaciones
- Toggle **Pablo activo / Manual** en el header de cada conversación
  - **Pablo activo** (verde): Pablo responde automáticamente
  - **Manual** (naranja): Pablo en pausa, el admin escribe directamente al padre
- Cuando Pablo está en pausa, los mensajes entrantes del padre se guardan en el historial pero no generan respuesta automática
- Banner naranja informativo cuando la conversación está en modo manual

### Respuesta manual desde el CRM
- Campo de texto + botón enviar en el footer del chat cuando el modo es Manual
- Los mensajes se envían vía Twilio desde el mismo número de AKU (el padre no percibe cambio de número)
- Atajo de teclado Cmd+Enter para enviar
- Los mensajes manuales quedan guardados en el historial con `role: assistant` — Pablo los verá como contexto cuando retome el control

### Continuidad de contexto
- Al reactivar a Pablo, retoma la conversación con pleno contexto de todo lo hablado, incluyendo los mensajes escritos manualmente por el admin durante la intervención

## Edge Functions

### Nueva función `send-whatsapp`
- Endpoint autenticado que envía mensajes vía Twilio API y los persiste en el historial de conversación
- Requiere sesión activa del CRM (JWT verificado contra Supabase Auth)

### Actualización `whatsapp-webhook`
- Pablo se silencia automáticamente cuando `escalated = true` — guarda el mensaje entrante pero no llama a Claude ni devuelve respuesta
- La escalación puede ser activada por el padre ("quiero hablar con una persona") o manualmente por el admin desde el CRM

## Correcciones
- **RLS**: añadida política UPDATE para `whatsapp_conversations` — sin ella el toggle no persistía en la base de datos
- Estilo de burbujas en la página de conversaciones alineado con el de la vista de detalle de lead
