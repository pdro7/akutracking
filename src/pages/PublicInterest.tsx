import { supabase } from '@/integrations/supabase/client';
import { InterestForm, UNDECIDED_COURSE, type InterestFormValues } from '@/components/InterestForm';

export default function PublicInterest() {
  return (
    <InterestForm
      title="Cuéntanos sobre ti"
      description="Nos ayuda a agruparte con otros niños que buscan lo mismo. Te contactamos cuando tengamos un grupo listo."
      submitLabel="Enviar"
      modalityLabel="Virtual"
      onSubmit={async (values: InterestFormValues) => {
        const undecided = values.interested_course_id === UNDECIDED_COURSE;
        const notes = [
          undecided ? 'Padre indicó: no ha decidido curso.' : null,
          values.notes.trim() || null,
        ].filter(Boolean).join(' ');
        const { data, error } = await supabase.functions.invoke('submit-interest', {
          body: {
            child_name: values.child_name,
            parent_name: values.parent_name,
            phone: values.phone,
            email: values.email,
            date_of_birth: values.date_of_birth || null,
            interested_course_id: undecided ? null : (values.interested_course_id || null),
            preferred_slots: values.preferred_slots,
            preferred_modality: 'virtual',
            notes,
          },
        });
        if (error) {
          let detail = error.message;
          try {
            const ctx = (error as any).context;
            if (ctx?.json) {
              const body = await ctx.json();
              if (body?.error) detail = body.error;
            }
          } catch { /* ignore */ }
          throw new Error(detail);
        }
        if (data?.error) throw new Error(data.error);
      }}
    />
  );
}
