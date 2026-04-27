/**
 * Pablo — WhatsApp Sales Assistant for AKUMAYA
 * =============================================
 * Receives Twilio WhatsApp webhooks, calls Claude to run the Pablo
 * assistant, captures leads automatically, and returns TwiML.
 *
 * Environment variables (set in Supabase → Edge Functions → Secrets):
 *   ANTHROPIC_API_KEY          → Anthropic API key
 *   TWILIO_AUTH_TOKEN          → (optional) Twilio Auth Token for signature validation
 *   SUPABASE_URL               → auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  → auto-injected
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PABLO_SYSTEM_PROMPT = `Eres Pablo, asistente de AKUMAYA Educación 🤖🇨🇴, una academia online que enseña programación, robótica, diseño 3D y creación de contenido a niños y niñas.

## TU PERSONALIDAD Y TONO
- Eres cálido, cercano y entusiasta
- Tuteas siempre (usa "tú", "tu hijo/hija", "cuéntame")
- Usas emojis de forma natural pero sin exagerar
- Eres profesional pero accesible
- Muestras genuino interés en ayudar
- SIEMPRE esperas la respuesta del usuario antes de continuar o ofrecer alternativas

## OBJETIVO PRINCIPAL
1. PRIMARIO: Que los padres realicen el pago y se inscriban directamente
2. SECUNDARIO: Si muestran dudas o tienen mucha experiencia, ofrecer clase de prueba gratuita
3. TERCIARIO: Mantener la conversación abierta para seguimiento

## REGLA DE ORO: NO TE ANTICIPES
- Después de dar información, ESPERA la respuesta del usuario
- NO ofrezcas alternativas o siguientes pasos hasta que el usuario responda
- NO asumas lo que el usuario va a preguntar o necesitar
- Responde SOLO a lo que el usuario pregunta o dice

## HERRAMIENTAS DISPONIBLES
Tienes dos herramientas que debes usar en los momentos indicados:

**register_lead**: Úsala en cuanto tengas el nombre del niño/a, el nombre del padre/madre y la ciudad. No esperes a tener todos los datos — registra pronto y actualiza después.

**escalate_to_human**: Úsala cuando el padre pida explícitamente hablar con una persona.

## ESCALAMIENTO A HUMANO
Si en cualquier momento el padre dice cosas como:
- "Quiero hablar con un humano"
- "Quiero hablar con otra persona"
- "Necesito hablar con alguien más"
- "Eres un robot?"

Responde: "¡Claro! Te conecto con mi equipo para que puedan ayudarte personalmente 😊"
Luego usa la herramienta escalate_to_human.

## MANEJO DE CONVERSACIONES REENVIADAS DEL NÚMERO COLOMBIANO
Si recibes un audio, captura de pantalla o texto copiado de una conversación:
- Entiende que es contexto de una conversación ya escalada
- Si hay info del proceso (pago, inscripción, etc.), retoma desde donde quedó
- Si es contexta nueva, empieza como nuevo contacto

## REGISTRO DE LEAD
Usa register_lead en cuanto tengas: nombre del niño/a, nombre del padre/madre y ciudad.
Campos disponibles: child_name, parent_name, city, course_interest, trial_class_date.
El teléfono se captura automáticamente del chat de WhatsApp.
Después de registrar, sigue la conversación con normalidad.

## FLUJO DE CONVERSACIÓN

### 1. SALUDO INICIAL
"¡Hola, cómo estás! 👋🏽 Bienvenida/o a AKUMAYA Educación 🤖🇨🇴, soy Pablo, es un placer para mi colaborarte el día de hoy ✨ Cuéntame, ¿en qué te puedo ayudar? 😊"

### 2. CALIFICACIÓN
Si aún no tienes edad y ciudad:
"Para poder brindarte info más precisa sobre nuestras actividades, cuéntame:
1. ¿Qué edad tiene tu hijo o hija?
2. ¿En qué ciudad se encuentran?"

ESPERA su respuesta.

Cuando respondan la ciudad:
"¡Perfecto! Para [CIUDAD] ofrecemos nuestros cursos 100% virtuales, en vivo con profesora. Son clases interactivas por Zoom, no son clases grabadas 😊

En Akumaya tenemos una ruta de aprendizaje completa donde los niños avanzan desde los conceptos básicos de programación por bloques hasta lenguajes profesionales como Python y Lua, creando videojuegos, apps y proyectos 3D."

Luego pregunta sobre experiencia.

**Si preguntan por presencial:**
"Actualmente solo ofrecemos modalidad presencial en Bucaramanga. Para [CIUDAD] tenemos disponible la modalidad virtual que funciona súper bien - las clases son en vivo, interactivas, y los niños pueden participar y hacer preguntas en tiempo real a la profesora 😊

Si quieres que [nombre] experimente cómo son nuestras clases virtuales, tenemos una clase de prueba gratuita sin ningún compromiso. ¿Te gustaría que te comparta el link para agendarla?"

### 3. EVALUACIÓN DE EXPERIENCIA
"¿Ha tenido tu hijo o hija alguna experiencia previa con programación, robótica o actividades similares? 😊"

ESPERA su respuesta.

- POCA experiencia (< 3 meses, < 10 clases): Trata como principiante
- MUCHA experiencia (> 6 meses): Ofrece clase de prueba para evaluar nivel

### 4. RECOMENDACIÓN DE CURSO + PRECIO + HORARIO

**CATEGORÍAS:**
🟢 EXPLORADORES (RCZ, RC1, RC2, MC1, MC2)
🔵 DESARROLLADORES (PGZ, PG1, PG2, RBX1, RBX2, Diseño 3D)
🟣 ESPECIALISTAS (PG3, Unity, Godot)

**PRINCIPIANTES por edad:**
- 8-10 años → Real Coders Zero (RCZ)
- 11-12 años → Real Coders 1 (RC1) o Minecraft Coders 1 (MC1)
- 13+ años → Python Zero (PGZ)

**CON MUCHA EXPERIENCIA:**
"¡Qué bien que ya tenga experiencia! 😊 Con ese nivel, sería ideal hacer una clase de prueba gratuita para evaluar exactamente dónde está. ¿Te gustaría agendarla? https://www.akumaya.co/clase-de-prueba-gratuita"

**HORARIOS SÁBADOS:**
- 8:30-10:00 AM: RC1, RCZ, PGZ, PG3
- 10:30-12:00 PM: RC2, PG1, PG2, MC1
- 2:00-3:30 PM: RCZ

**Formato de recomendación:**
"Perfecto! Para [nombre/edad] te recomiendo **[NOMBRE DEL CURSO]**.

Son 8 clases de 1 hora y media, los sábados de [HORARIO].

Puedes pagarlo en 2 cuotas de $[PRECIO] o en una sola cuota con descuento especial por $[PRECIO COMPLETO] 😊

Los grupos abren cuando tenemos mínimo 3-4 niños inscritos. En cuanto confirmes tu inscripción te avisamos con la fecha de inicio."

**PRECIOS:**
🟢 Exploradores: 2 pagos $149.000 c/u | 1 pago $259.000
🔵 Desarrolladores: 2 pagos $164.000 c/u | 1 pago $289.000
🟣 Especialistas: 2 pagos $179.000 c/u | 1 pago $319.000

### 5. PROCESO DE INSCRIPCIÓN
"¡Perfecto! 😊 El primer paso es realizar el pago:

- Online con tarjeta/PSE: https://checkout.wompi.co/l/AZ9CzW
- Davivienda ahorros 1089-0019-1769, AKUMAYA Educación NIT 901609937-1
- Bancolombia ahorros 291-000132-10, AKUMAYA Educación NIT 901609937-1

Una vez realices el pago, me compartes el soporte por aquí ☺️"

Cuando envíen comprobante:
"¡Perfecto! Ya recibí el comprobante 😊 Diligencia por favor el formulario https://forms.gle/UyqpPYgmZKr9dY2s9 😉"

Cuando confirmen formulario:
"¡Excelente! 🎉 En los próximos días te llegará un correo de bienvenida con el link de Zoom e información sobre las herramientas. En cuanto el grupo esté confirmado con la fecha de inicio, te avisamos. ¡Nos vemos pronto! 🚀"

### 6. CLASE DE PRUEBA
Solo ofrece cuando: mucha experiencia, dudas después del precio, preguntan por ella, querían presencial, "no sé si le va a gustar".

"También tenemos una clase de prueba gratuita donde [tu hijo/hija] puede experimentar nuestra dinámica. ¿Te gustaría agendarla?
https://www.akumaya.co/clase-de-prueba-gratuita"

### 7. INFORMACIÓN
**Horarios sábado:** Ver tabla en sección 4.
**Horarios entre semana:** "¿Qué días y horarios te quedan bien después de las 4:00 PM? Los organizamos según demanda 😊"
**Próximo inicio:** "Cuando juntemos mínimo 3-4 niños. ¡Los cupos son limitados (máx 6-8 por grupo)!"
**Formato:** "100% virtual, Zoom, EN VIVO con profesora (no grabadas). Se graban por si necesitan repasar 😊"
**Requisitos:** Computador Windows 10/11 o Mac, internet estable, Zoom.

### 8. OBJECIONES
**"Voy a consultarlo":** Ofrece clase de prueba y dice que puede escribir cuando quiera.
**"Me parece costoso":** Calcula precio por hora (precio÷12) y menciona grupos pequeños.
**"¿Cuándo empieza?":** "Cuando juntemos mínimo 3-4 niños. ¡Reserva tu cupo y te avisamos!"
**"No sé si le va a gustar":** Ofrece clase de prueba gratuita.

### 9. PREGUNTAS FRECUENTES
- **Certificado:** Sí, bajo petición al terminar.
- **Clase perdida:** Queda grabada disponible.
- **Cambio de horario:** Posible si hay otro grupo del mismo curso.
- **Después del curso:** Continúa con el siguiente nivel.

## REGLAS IMPORTANTES
1. NUNCA inventes información que no esté en este prompt
2. SIEMPRE pregunta edad Y ciudad antes de experiencia
3. SIEMPRE aclara que son clases virtuales EN VIVO
4. SIEMPRE incluye horario específico al recomendar curso
5. "Un par de meses" = PRINCIPIANTE
6. PRIORIZA VENDER DIRECTAMENTE
7. NUNCA te anticipes — ESPERA respuesta del usuario
8. NO ofrezcas clase de prueba hasta que haya dudas o mucha experiencia
9. NUNCA menciones fecha fija de inicio — los grupos abren bajo demanda
10. Usa register_lead tan pronto tengas nombre del niño, padre y ciudad. Incluye siempre city y age cuando los tengas.
11. Usa add_note en estos momentos clave:
    - Cuando el padre dice que lo va a consultar con su pareja → nota: "Lo consultará con su pareja/esposo/a"
    - Cuando muestra una objeción específica (precio, horario, etc.) → nota con el detalle
    - Cuando agenda clase de prueba → nota: "Agendó clase de prueba para [fecha]"
    - Al final de cualquier conversación significativa con un resumen breve
12. REGLA DE ORO: después de cada mensaje, ESPERA respuesta antes de continuar`;

// Claude tools definitions
const TOOLS = [
  {
    name: 'register_lead',
    description:
      'Register or update a lead in the CRM system. Call this as soon as you have child name, parent name, and city. Call again whenever you get more info (age, course, trial date, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        child_name: { type: 'string', description: 'Name of the child' },
        parent_name: { type: 'string', description: 'Name of the parent' },
        city: { type: 'string', description: 'City where they live' },
        age: { type: 'string', description: "Child's age, e.g. \"9 años\"" },
        course_interest: {
          type: 'string',
          description: 'Course recommended or interested in (e.g. RCZ, PGZ)',
        },
        trial_class_date: {
          type: 'string',
          description: 'Trial class date in YYYY-MM-DD format if scheduled',
        },
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'trial_scheduled', 'trial_attended', 'enrolled', 'lost'],
          description: 'Current lead status',
        },
      },
      required: ['child_name', 'parent_name', 'city'],
    },
  },
  {
    name: 'add_note',
    description:
      'Add a follow-up note to the lead record. Use at key moments: when parent says they will consult their partner, when they show a specific objection, when they schedule a trial class, or at the end of any meaningful conversation.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Note content in Spanish, concise and factual' },
      },
      required: ['content'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Mark this conversation for human takeover when the user explicitly requests to speak with a person.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why escalation was triggered' },
      },
      required: ['reason'],
    },
  },
];

// Extraction prompt — used when the internal AKU number sends "Nuevo LID" + image
const EXTRACTION_SYSTEM_PROMPT = `Eres un asistente interno de AKUMAYA. Tu única tarea es extraer información de leads a partir de imágenes o texto y registrarlos en el sistema con register_lead.

Cuando recibas una imagen o mensaje con datos de un potencial cliente:
1. Extrae toda la información visible: nombre del niño/a, nombre del padre/madre, teléfono, edad, ciudad, curso de interés.
2. El teléfono es el dato más importante — encuéntralo aunque esté en formato informal (ej: "312 345 6789", "3123456789", "+57 312 345 6789"). Normalízalo quitando espacios.
3. Llama a register_lead con todo lo que hayas podido extraer.
4. Responde con un resumen breve: qué datos encontraste y qué registraste. Si faltó algún dato clave, indícalo.

NUNCA inventes datos. Si algo no aparece en la imagen o el texto, omítelo.`;

// Max messages to keep in history (to avoid token overflow)
const MAX_HISTORY_MESSAGES = 40;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse Twilio's form-encoded body
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

    const from = params.get('From') ?? ''; // e.g. "whatsapp:+573001234567"
    const body = params.get('Body') ?? '';
    const numMedia = parseInt(params.get('NumMedia') ?? '0', 10);

    // Process media attachments
    type ImageData = { base64: string; mediaType: string; permanentUrl: string };
    let imageData: ImageData | null = null;
    let userContent = body;

    if (numMedia > 0) {
      const mediaType = params.get('MediaContentType0') ?? '';
      const mediaUrl = params.get('MediaUrl0') ?? '';

      if (mediaType.startsWith('image/')) {
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

        if (accountSid && authToken) {
          try {
            // Download image from Twilio (requires Basic Auth)
            const mediaRes = await fetch(mediaUrl, {
              headers: { 'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`) },
            });
            const imageBuffer = await mediaRes.arrayBuffer();

            // Safe base64 encoding (avoids stack overflow on large images)
            const uint8 = new Uint8Array(imageBuffer);
            let binary = '';
            const chunk = 8192;
            for (let i = 0; i < uint8.length; i += chunk) {
              binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
            }
            const base64 = btoa(binary);

            // Upload to Supabase Storage for permanent URL
            const ext = mediaType.split('/')[1]?.split(';')[0] || 'jpg';
            const fileName = `${crypto.randomUUID()}.${ext}`;
            await supabase.storage.from('whatsapp-media').upload(fileName, imageBuffer, { contentType: mediaType });
            const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);

            imageData = { base64, mediaType, permanentUrl: urlData.publicUrl };
          } catch (e) {
            console.error('Image processing error:', e);
            userContent = body ? `[Imagen adjunta]\n${body}` : '[El usuario envió una imagen]';
          }
        } else {
          userContent = body ? `[Imagen adjunta]\n${body}` : '[El usuario envió una imagen]';
        }
      } else if (mediaType.startsWith('audio/')) {
        userContent = body
          ? `[Audio adjunto: ${mediaUrl}]\n${body}`
          : `[El usuario envió un audio]`;
      }
    }

    if (!imageData && !userContent.trim()) {
      return twimlResponse('');
    }

    // Detect if this is a lead extraction request from the internal AKU number
    const internalNumber = Deno.env.get('AKU_INTERNAL_NUMBER') ?? '';
    const isFromInternal = internalNumber && from.includes(internalNumber);
    const isNewLeadTrigger = isFromInternal && (
      body.toLowerCase().includes('nuevo lid') ||
      body.toLowerCase().includes('nuevo lead') ||
      body.toLowerCase().includes('new lead')
    );

    // Fetch or create conversation record
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('id, messages, lead_id, escalated')
      .eq('phone', from)
      .maybeSingle();

    const conversationId = conversation?.id ?? null;
    const existingMessages: { role: string; content: string }[] =
      conversation?.messages ?? [];
    const existingLeadId: string | null = conversation?.lead_id ?? null;

    // Build Claude-compatible message list from history
    // Messages with image_url become text placeholders (we only send base64 for the current message)
    type StoredMessage = { role: string; content: string; image_url?: string };
    const claudeHistory = (existingMessages as StoredMessage[]).map(msg => ({
      role: msg.role,
      content: msg.image_url
        ? (msg.content && msg.content !== '[Imagen]'
            ? `[Imagen enviada anteriormente] ${msg.content}`
            : '[Imagen enviada anteriormente]')
        : msg.content,
    }));

    // Current user message — use vision content array if image present
    const currentClaudeMessage = imageData
      ? {
          role: 'user' as const,
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.base64 } },
            ...(body.trim() ? [{ type: 'text', text: body }] : []),
          ],
        }
      : { role: 'user' as const, content: userContent };

    const messages = [...claudeHistory, currentClaudeMessage].slice(-MAX_HISTORY_MESSAGES);

    // What we store in DB for the current user turn
    const storedUserMessage: StoredMessage = imageData
      ? { role: 'user', content: body || '[Imagen]', image_url: imageData.permanentUrl }
      : { role: 'user', content: userContent };

    // If the conversation is escalated, save the message but do NOT call Claude
    if (conversation?.escalated) {
      const updatedMessages = [...existingMessages, storedUserMessage].slice(-MAX_HISTORY_MESSAGES);
      await supabase
        .from('whatsapp_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      return twimlResponse('');
    }

    // Call Claude API
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: isNewLeadTrigger ? EXTRACTION_SYSTEM_PROMPT : PABLO_SYSTEM_PROMPT,
        // In extraction mode, skip history — just send the current image/message
        messages: isNewLeadTrigger ? [currentClaudeMessage] : messages,
        tools: TOOLS,
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeResponse.json();

    // Process response content blocks
    let assistantText = '';
    let leadId = existingLeadId;
    let escalated = conversation?.escalated ?? false;

    for (const block of claudeData.content ?? []) {
      if (block.type === 'text') {
        assistantText = block.text;
      } else if (block.type === 'tool_use') {
        if (block.name === 'register_lead') {
          const input = block.input as {
            child_name: string;
            parent_name: string;
            city: string;
            age?: string;
            course_interest?: string;
            trial_class_date?: string;
            status?: string;
          };

          const phone = from.replace('whatsapp:', '');
          const leadStatus = input.trial_class_date ? 'trial_scheduled' : (input.status ?? 'new');

          if (leadId) {
            await supabase
              .from('leads')
              .update({
                child_name: input.child_name,
                parent_name: input.parent_name,
                city: input.city ?? null,
                age: input.age ?? null,
                course_interest: input.course_interest ?? null,
                trial_class_date: input.trial_class_date ?? null,
                status: leadStatus as any,
                updated_at: new Date().toISOString(),
              })
              .eq('id', leadId);
          } else {
            const { data: newLead } = await supabase
              .from('leads')
              .insert({
                child_name: input.child_name,
                parent_name: input.parent_name,
                phone,
                city: input.city ?? null,
                age: input.age ?? null,
                source: 'whatsapp' as any,
                status: leadStatus as any,
                course_interest: input.course_interest ?? null,
                trial_class_date: input.trial_class_date ?? null,
              })
              .select('id')
              .single();
            leadId = newLead?.id ?? null;
          }
        } else if (block.name === 'add_note') {
          const input = block.input as { content: string };
          if (leadId && input.content) {
            await supabase.from('lead_notes').insert({
              lead_id: leadId,
              content: input.content,
            });
          }
        } else if (block.name === 'escalate_to_human') {
          escalated = true;
        }
      }
    }

    // If Claude stopped to use tools but has no text yet, do a follow-up call
    // (tool_use stop_reason means Claude wants to continue after tool result)
    if (claudeData.stop_reason === 'tool_use' && !assistantText) {
      const toolResults = (claudeData.content ?? [])
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: b.name === 'register_lead' ? 'Lead registrado correctamente.' : b.name === 'add_note' ? 'Nota añadida correctamente.' : 'Escalado correctamente.',
        }));

      const followUp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: isNewLeadTrigger ? EXTRACTION_SYSTEM_PROMPT : PABLO_SYSTEM_PROMPT,
          messages: [
            ...messages,
            { role: 'assistant', content: claudeData.content },
            { role: 'user', content: toolResults },
          ],
          tools: TOOLS,
        }),
      });

      const followUpData = await followUp.json();
      for (const block of followUpData.content ?? []) {
        if (block.type === 'text') assistantText = block.text;
      }
    }

    // Save updated conversation (use stored format, not Claude format)
    const updatedMessages = [
      ...existingMessages,
      storedUserMessage,
      { role: 'assistant', content: assistantText },
    ].slice(-MAX_HISTORY_MESSAGES);

    if (conversationId) {
      await supabase
        .from('whatsapp_conversations')
        .update({
          messages: updatedMessages,
          lead_id: leadId,
          escalated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    } else {
      await supabase.from('whatsapp_conversations').insert({
        phone: from,
        messages: updatedMessages,
        lead_id: leadId,
        escalated,
      });
    }

    return twimlResponse(assistantText);
  } catch (err) {
    console.error('whatsapp-webhook error:', err);
    return twimlResponse(
      'Lo siento, tuve un problema técnico. Por favor intenta de nuevo en un momento 🙏',
    );
  }
});

function twimlResponse(message: string): Response {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${safe ? `<Message>${safe}</Message>` : ''}</Response>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
