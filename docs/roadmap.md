# AKU Tracker — Roadmap de funcionalidades

Ideas pendientes de evaluar e implementar, organizadas por área.

---

## Pagos y finanzas
- [ ] Registro de pagos recibidos con fecha y monto (historial por alumno)
- [ ] Reporte de ingresos por mes
- [ ] Alerta automática cuando un alumno lleva X semanas sin renovar

## Comunicación con padres
- [ ] Envío automático de WhatsApp o email cuando quedan ≤2 clases (Twilio / Resend)
- [ ] Resumen mensual del progreso del hijo por email

## Seguimiento académico
- [ ] Notas por sesión (qué aprendió, cómo le fue)
- [ ] Nivel de progreso por módulo completado
- [ ] Certificado de finalización al completar un curso virtual

## Reportes
- [ ] Tasa de conversión de leads a alumnos
- [ ] Cursos más populares
- [ ] Ingresos por mes / por curso
- [ ] Alumnos que han renovado vs los que no

## Operación
- [ ] Vista de calendario con todas las clases (presencial + virtual)
- [ ] Exportar listados a Excel/CSV
- [ ] App móvil / PWA para marcar asistencia desde el teléfono

## Pablo — mejoras pendientes
- [ ] Seguimiento automático de conversaciones sin respuesta: job programado que detecta leads/ex-alumnos sin respuesta en X días y Pablo les envía un mensaje de seguimiento automáticamente
- [ ] Plantillas adicionales de WhatsApp: follow-up para leads fríos, recordatorio de clase de prueba, post-prueba
- [ ] Actualizar Google Apps Script de Calendly para insertar en `leads` en lugar de `trial_leads`

## Reactivación de ex-alumnos
- [ ] Flujo de reactivación desde `students` activos que llevan tiempo sin renovar pack (no solo ex-alumnos importados)
- [ ] Mensaje de plantilla específico para reactivación (diferente al de captación de leads nuevos)
