-- "¿Cómo nos has conocido?" en columna propia, no dentro de notes.
--
-- El webhook de Calendly metía esta respuesta concatenada en notes
-- ("Referido: Instagram | Ciudad: ..."), donde es imposible de agregar.
-- En columna se puede contar por canal, que es justo para lo que sirve.
--
-- Ojo: no confundir con leads.source (canal técnico de entrada al CRM:
-- web, whatsapp, calendly...) ni con referred_by_student_id (programa de
-- referidos con código). Esto es lo que declara el propio padre.
-- Los valores posibles viven en src/lib/referralSources.ts.

alter table public.leads
  add column if not exists referral_source text;

comment on column public.leads.referral_source is
  'Canal declarado por el padre en el formulario público: cómo nos conoció.';
