import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TimeSlotPicker } from '@/components/TimeSlotPicker';

// Sentinel value used in the course select to represent "I haven't decided yet".
// The client resolves this to interested_course_id=null and course_interest="No decidido aún"
// before calling the edge function.
export const UNDECIDED_COURSE = 'undecided';

export type InterestFormValues = {
  child_name: string;
  parent_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  interested_course_id: string;
  preferred_slots: string[];
  notes: string;
};

type Props = {
  title: string;
  description: string;
  submitLabel: string;
  initial?: Partial<InterestFormValues>;
  showNotes?: boolean;
  onSubmit: (values: InterestFormValues) => Promise<void>;
  successMessage?: string;
  modalityLabel?: string;
};

const empty: InterestFormValues = {
  child_name: '',
  parent_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  interested_course_id: '',
  preferred_slots: [],
  notes: '',
};

export function InterestForm({ title, description, submitLabel, initial, showNotes = true, onSubmit, successMessage, modalityLabel = 'Virtual' }: Props) {
  const [values, setValues] = useState<InterestFormValues>({ ...empty, ...initial });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (initial) setValues((v) => ({ ...v, ...initial }));
  }, [initial]);

  const { data: courses = [] } = useQuery({
    queryKey: ['virtual_courses_public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_courses')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    },
  });

  const set = <K extends keyof InterestFormValues>(k: K, v: InterestFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.child_name.trim() || !values.parent_name.trim() || !values.phone.trim()) {
      toast.error('Nombre del niño, del padre y teléfono son obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>¡Gracias!</CardTitle>
            <CardDescription>
              {successMessage ?? 'Recibimos tus preferencias. Te contactamos apenas tengamos un grupo que te encaje.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Modalidad: {modalityLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Nombre del niño/a *</Label>
                  <Input value={values.child_name} onChange={(e) => set('child_name', e.target.value)} required />
                </div>
                <div>
                  <Label className="mb-1 block">Fecha de nacimiento del niño/a</Label>
                  <Input
                    type="date"
                    value={values.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Tu nombre (padre/madre) *</Label>
                  <Input value={values.parent_name} onChange={(e) => set('parent_name', e.target.value)} required />
                </div>
                <div>
                  <Label className="mb-1 block">Teléfono / WhatsApp *</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="+57 300 000 0000"
                    value={values.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Email (opcional)</Label>
                  <Input
                    type="email"
                    inputMode="email"
                    value={values.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Curso de interés</Label>
                  <Select value={values.interested_course_id} onValueChange={(v) => set('interested_course_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Elige un curso" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNDECIDED_COURSE}>No lo he decidido / no lo sé</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TimeSlotPicker
                value={values.preferred_slots}
                onChange={(v) => set('preferred_slots', v)}
                label="Franjas horarias que te sirven"
              />

              {showNotes && (
                <div>
                  <Label className="mb-1 block">Cuéntanos algo más (opcional)</Label>
                  <Textarea
                    value={values.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Edad del niño, experiencia previa, alguna preferencia particular..."
                    rows={3}
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting} className="w-full md:w-auto md:min-w-[180px]">
                  {submitting ? 'Enviando...' : submitLabel}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
