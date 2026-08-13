import { supabase } from '@/integrations/supabase/client';
import { InterestForm, UNDECIDED_COURSE, type InterestFormValues } from '@/components/InterestForm';

export default function PublicInterest() {
  const referralCode = typeof window !== 'undefined'
    ? window.localStorage.getItem('aku_referral_code') || undefined
    : undefined;

  return (
    <InterestForm
      title="Cuéntanos sobre tu hijo(a)"
      description="Sus preferencias y disponibilidad horaria nos ayudan a organizar los grupos más rápido y a que encajen con tu agenda."
      submitLabel="Enviar"
      modalityLabel="Virtual"
      referralCode={referralCode}
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
            referral_code: referralCode,
          },
        });
        if (!error && !data?.error && referralCode && typeof window !== 'undefined') {
          window.localStorage.removeItem('aku_referral_code');
        }
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
