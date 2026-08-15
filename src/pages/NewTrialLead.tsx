import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { TimeSlotPicker } from '@/components/TimeSlotPicker';
import { TrialSlotPicker, type TrialSlotValue } from '@/components/TrialSlotPicker';
import { LEAD_MODALITY_OPTIONS } from '@/lib/subjects';
import { translateBookingError } from '@/lib/trialWindows';
import { useState } from 'react';

const trialLeadSchema = z.object({
  childName: z.string().min(1, 'Nombre requerido').max(100),
  dateOfBirth: z.string().optional(),
  parentName: z.string().min(1, 'Nombre requerido').max(100),
  parentPhone: z.string().max(20).optional().or(z.literal('')),
  parentEmail: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  status: z.enum(['trial_scheduled', 'trial_attended', 'enrolled', 'trial_cancelled', 'trial_no_show', 'interested']),
  notes: z.string().max(500).optional(),
  interestedCourseId: z.string().optional(),
  preferredSlots: z.array(z.string()).default([]),
  preferredModality: z.string().optional(),
  desiredStartBy: z.string().optional(),
});

type TrialLeadFormValues = z.infer<typeof trialLeadSchema>;

export default function NewTrialLead() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TrialLeadFormValues>({
    resolver: zodResolver(trialLeadSchema),
    defaultValues: {
      childName: '',
      dateOfBirth: '',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      status: 'trial_scheduled',
      notes: '',
      interestedCourseId: '',
      preferredSlots: [],
      preferredModality: '',
      desiredStartBy: '',
    },
  });

  const [slot, setSlot] = useState<TrialSlotValue>({ date: '', time: '', force: false });

  const { data: courses = [] } = useQuery({
    queryKey: ['virtual_courses'],
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

  const addTrialLeadMutation = useMutation({
    mutationFn: async (values: TrialLeadFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!slot.date) throw new Error('Elige un horario para la clase de prueba');

      const { data, error } = await supabase.from('leads').insert({
        child_name: values.childName,
        date_of_birth: values.dateOfBirth || null,
        parent_name: values.parentName,
        phone: values.parentPhone || null,
        email: values.parentEmail || null,
        status: values.status as any,
        notes: values.notes || null,
        source: 'other' as any,
        created_by: user.id,
        interested_course_id: values.interestedCourseId || null,
        preferred_slots: values.preferredSlots,
        preferred_modality: values.preferredModality || null,
        desired_start_by: values.desiredStartBy || null,
      }).select().single();

      if (error) throw error;

      // La fecha y hora no se escriben directamente en leads: pasan por el
      // RPC, que asigna profesor, respeta la ocupación y deja el trigger
      // sincronizar leads. Es el mismo camino que usa el link público.
      const { error: bookErr } = await (supabase as any).rpc('book_trial_slot', {
        p_lead_id: data.id,
        p_date: slot.date,
        p_start: slot.time || '09:00',
        p_source: 'admin',
        p_course_id: values.interestedCourseId || null,
        p_actor: user.id,
        p_force: slot.force,
      });
      if (bookErr) {
        // El lead se creó pero la reserva falló. Sin fecha no aparecería en
        // /trial-leads, así que quedaría huérfano e invisible: se borra para
        // que el admin pueda reintentar limpiamente.
        await supabase.from('leads').delete().eq('id', data.id);
        throw new Error(translateBookingError(bookErr.message));
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trial-leads'] });
      toast({ title: 'Clase de prueba agregada' });
      navigate(`/trial-leads/${data.id}`);
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    },
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/trial-leads')} className="gap-2 mb-4">
          <ArrowLeft size={18} />
          Clases de prueba
        </Button>
        <h1 className="text-3xl font-bold">Nueva clase de prueba</h1>
        <p className="text-muted-foreground">Registrar una nueva clase de prueba manualmente</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => addTrialLeadMutation.mutate(v))} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Niño/a</CardTitle>
              <CardDescription>Datos del estudiante</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="childName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl><Input placeholder="Nombre del niño/a" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de nacimiento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Padre / Madre</CardTitle>
              <CardDescription>Información de contacto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl><Input placeholder="Nombre del padre/madre" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
                    <FormControl><Input placeholder="Número de celular" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="Email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferencias</CardTitle>
              <CardDescription>Ayudan a agrupar al niño con otros interesados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="interestedCourseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Curso de interés</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="preferredModality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalidad preferida</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Sin preferencia" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LEAD_MODALITY_OPTIONS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="desiredStartBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empezar antes de</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="preferredSlots"
                render={({ field }) => (
                  <FormItem>
                    <TimeSlotPicker
                      value={field.value || []}
                      onChange={field.onChange}
                      label="Franjas horarias que le sirven"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clase de prueba</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <FormLabel>Horario *</FormLabel>
                <p className="text-xs text-muted-foreground mb-2">
                  Sólo se muestran huecos con algún profesor libre. Se asigna
                  automáticamente al reservar.
                </p>
                <TrialSlotPicker value={slot} onChange={setSlot} />
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="trial_scheduled">Agendado</SelectItem>
                        <SelectItem value="trial_attended">Asistió</SelectItem>
                        <SelectItem value="interested">Interesado</SelectItem>
                        <SelectItem value="enrolled">Inscrito</SelectItem>
                        <SelectItem value="trial_cancelled">Cancelado</SelectItem>
                        <SelectItem value="trial_no_show">No asistió</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl><Textarea placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/trial-leads')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addTrialLeadMutation.isPending}>
              {addTrialLeadMutation.isPending ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
