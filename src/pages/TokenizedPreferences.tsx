import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { InterestForm, type InterestFormValues } from '@/components/InterestForm';

async function parseErrorMessage(error: any): Promise<string> {
  let detail = error?.message ?? 'Error';
  try {
    const ctx = error?.context;
    if (ctx?.json) {
      const body = await ctx.json();
      if (body?.error) detail = body.error;
    }
  } catch { /* ignore */ }
  return detail;
}

export default function TokenizedPreferences() {
  const { token } = useParams();
  const [initial, setInitial] = useState<Partial<InterestFormValues> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('Enlace no válido');
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke('lead-preferences', {
        body: { action: 'read', token },
      });
      if (error) {
        setLoadError(await parseErrorMessage(error));
      } else if (data?.error) {
        setLoadError(data.error);
      } else if (data?.lead) {
        setInitial({
          child_name: data.lead.child_name || '',
          parent_name: data.lead.parent_name || '',
          phone: data.lead.phone || '',
          email: data.lead.email || '',
          interested_course_id: data.lead.interested_course_id || '',
          preferred_slots: Array.isArray(data.lead.preferred_slots) ? data.lead.preferred_slots : [],
          preferred_modality: data.lead.preferred_modality || '',
          desired_start_by: data.lead.desired_start_by || '',
        });
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enlace no válido</CardTitle>
            <CardDescription>{loadError}. Si sigues teniendo problemas, contáctanos por WhatsApp.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <InterestForm
      title="Actualiza tus preferencias"
      description="Confirma tus datos y elige tus franjas para armarte un grupo cuanto antes."
      submitLabel="Guardar preferencias"
      initial={initial ?? undefined}
      showNotes={false}
      successMessage="Guardamos tus preferencias. Te contactamos apenas tengamos grupo."
      onSubmit={async (values: InterestFormValues) => {
        const { data, error } = await supabase.functions.invoke('lead-preferences', {
          body: {
            action: 'write',
            token,
            child_name: values.child_name,
            parent_name: values.parent_name,
            phone: values.phone,
            email: values.email || null,
            interested_course_id: values.interested_course_id || null,
            preferred_slots: values.preferred_slots,
            preferred_modality: values.preferred_modality || null,
            desired_start_by: values.desired_start_by || null,
          },
        });
        if (error) throw new Error(await parseErrorMessage(error));
        if (data?.error) throw new Error(data.error);
      }}
    />
  );
}
