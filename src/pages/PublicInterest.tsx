import { supabase } from '@/integrations/supabase/client';
import { InterestForm, type InterestFormValues } from '@/components/InterestForm';

export default function PublicInterest() {
  return (
    <InterestForm
      title="Cuéntanos sobre ti"
      description="Nos ayuda a agruparte con otros niños que buscan lo mismo. Te contactamos cuando tengamos un grupo listo."
      submitLabel="Enviar"
      onSubmit={async (values: InterestFormValues) => {
        const { data, error } = await supabase.functions.invoke('submit-interest', {
          body: values,
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
