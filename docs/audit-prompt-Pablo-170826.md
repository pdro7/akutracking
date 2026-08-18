🔴 Críticos (rompen funcionalidad hoy)

1. course_slots está vacía → toda la sección FRANJAS está muerta

Consulté la tabla: 0 filas. Eso significa que hoy, en cada conversación, Pablo inyecta "No hay franjas configuradas actualmente" y por la Regla 15 nunca puede dar un horario.

Y aquí está el peligro: la Regla 4 dice "SIEMPRE incluye horario específico al recomendar curso" — una orden que la data hace imposible cumplir. Combinado con la Regla 1 ("nunca inventes"), el modelo queda ante instrucciones contradictorias, y Haiku bajo contradicción tiende a inventar un horario. Igual pasa con el template que dice "los sábados de [HORARIO]".

Sugerencia: o poblar course_slots (se administra desde Settings), o condicionar las reglas 4/13 a "si hay franjas activas". Esto es lo primero a resolver.

2. El link de clase de prueba apunta al agendador viejo

El prompt usa https://www.akumaya.co/clase-de-prueba-gratuita (2 veces). Pero ya tienes agendador propio en producción: rutas públicas /agendar (PublicTrialBooking) y /mi-clase/:token. Pablo está enviando padres al flujo legacy (Calendly), justo el que quedaba por apagar.

Efecto colateral: como el padre agenda fuera, trial_class_date en register_lead casi nunca se llena → el lead queda sin fecha.

3. Catálogo de cursos desincronizado con virtual_courses

Comparé las categorías del prompt con la BD:

- Menciona cursos que no existen: Diseño 3D y Godot no están en virtual_courses.
- Faltan cursos activos reales: IA1, IAG1, IAG2 (toda la línea de IA), YT1/YT2 (YouTube Creator), PG5/PG5-APIS.

Como la Regla 1 prohíbe inventar, Pablo literalmente no puede ofrecer los cursos de IA — probablemente lo más vendible hoy. Y hay incoherencia interna: la intro dice que la academia enseña "creación de contenido", pero ningún curso de eso aparece en las categorías.

▎ Nota lateral (CRM, no Pablo): PG5 "Python APIS" y PG5-APIS "Python APIs" están duplicados en la BD.

---
🟠 Medios (coherencia y conversión)

4. "Tienes dos herramientas" → en realidad son tres. add_note no aparece en la sección HERRAMIENTAS DISPONIBLES, pese a que las Reglas 11, 14, 15 y el paso 7 la usan intensivamente. Riesgo de infrautilización.

5. Bucaramanga: se pierde la venta del presencial. El paso 2 responde a cualquier ciudad con "Para [CIUDAD] ofrecemos nuestros cursos 100% virtuales" — incluida Bucaramanga, donde sí hay sede presencial. Solo menciona presencial si el padre pregunta. Debería ramificar por ciudad.

6. Contradicción sobre la fecha de inicio. Reglas 9 y 13 exigen mencionar la fecha tentativa; pero el "Formato de recomendación" cierra con "te avisamos con la fecha de inicio" (o sea, sin fecha). Se pisan entre sí.

7. "Los sábados" hardcodeado en el template, mientras las Reglas 14/15 y el paso 7 contemplan entre semana.

8. La rama "CON MUCHA EXPERIENCIA" mata la venta. En el paso 4, si el niño tiene experiencia, Pablo salta directo a la clase de prueba sin dar curso ni precio — contradice el Objetivo Primario y la Regla 6 ("PRIORIZA VENDER DIRECTAMENTE").

9. Sección "CONVERSACIONES REENVIADAS" es engañosa. Le pide a Pablo interpretar audios, pero Pablo no puede oír audio: el código solo hace visión de imágenes; un audio llega como el texto [El usuario envió un audio]. Instrucción imposible de cumplir.

10. El .md canónico está desfasado del código. pablo-assistant-prompt.md todavía dice que al escalar "reenvía esta conversación al número de WhatsApp de AKU Colombia" — capacidad que no existe (en el código ya es la tool escalate_to_human). Según docs/pablo.md el .md es la fuente conceptual, así que conviene resincronizar.

---
🟡 Menores (pulido)

11. El prompt lista los campos de register_lead como "child_name, parent_name, city, course_interest, trial_class_date" — omite age y status, pero la Regla 10 exige "incluye siempre city y age". Incoherencia interna.

12. Falta la regla de "no te presentes como IA": docs/pablo.md §1 la declara, pero no está en el prompt. Además, la descripción de la tool escalate_to_human dice solo "when the user explicitly requests to speak with a person", desalineada con el prompt (que también escala ante "¿eres un robot?").

13. Typos: "es un placer para mi" → mí; "Si es contexta nueva" → contexto.

14. Estructural: ## FRANJAS DISPONIBLES (h2) queda incrustada dentro del paso 4 (h3), rompiendo la numeración del flujo.

15. El paso 2 (presencial) ofrece clase de prueba antes de calificar, en tensión con la Regla 8.

✅ Lo que sí está coherente: precios (cuadran con docs/pablo.md), el cálculo "precio÷12" (8 clases × 1.5h = 12h), links de Wompi/Forms, y la recomendación por edad.

---
Mi recomendación de orden

1. Decidir franjas (#1) — sin esto, medio prompt es letra muerta.
2. Actualizar link de clase de prueba al agendador propio (#2) — cambio pequeño, impacto directo.
3. Sincronizar catálogo con la BD (#3), sobre todo meter IA.
4. Luego el bloque medio (#4–#8), que es reescritura de prompt.
5. Al final, pulido y resincronizar el .md (#9–#15).

Los puntos 2, 3 y 4 son de bajo riesgo. El bloque medio ya toca el flujo comercial, así que ahí conviene ir con más cuidado y probar.

Dos preguntas para decidir:
- ¿Cuál es la URL pública del agendador? (/agendar sobre qué dominio — ¿app.akumaya.co, akumaya.co…?) La necesito para el reemplazo.
- Las franjas: ¿las vas a poblar en Settings, o prefieres que suavice las reglas para que Pablo funcione sin ellas?

