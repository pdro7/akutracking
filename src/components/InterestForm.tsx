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
import { LEAD_MODALITY_OPTIONS } from '@/lib/subjects';

export type InterestFormValues = {
  child_name: string;
  parent_name: string;
  phone: string;
  email: string;
  interested_course_id: string;
  preferred_slots: string[];
  preferred_modality: string;
  desired_start_by: string;
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
};

const empty: InterestFormValues = {
  child_name: '',
  parent_name: '',
  phone: '',
  email: '',
  interested_course_id: '',
  preferred_slots: [],
  preferred_modality: '',
  desired_start_by: '',
  notes: '',
};

export function InterestForm({ title, description, submitLabel, initial, showNotes = true, onSubmit, successMessage }: Props) {
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
      <div className="max-w-lg mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="mb-1 block">Nombre del niño/a *</Label>
                <Input value={values.child_name} onChange={(e) => set('child_name', e.target.value)} required />
              </div>
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
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Modalidad</Label>
                <Select value={values.preferred_modality} onValueChange={(v) => set('preferred_modality', v)}>
                  <SelectTrigger><SelectValue placeholder="Sin preferencia" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_MODALITY_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TimeSlotPicker
                value={values.preferred_slots}
                onChange={(v) => set('preferred_slots', v)}
                label="Franjas horarias que te sirven"
              />
              <div>
                <Label className="mb-1 block">Nos gustaría empezar antes de</Label>
                <Input type="date" value={values.desired_start_by} onChange={(e) => set('desired_start_by', e.target.value)} />
              </div>
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
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Enviando...' : submitLabel}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
