import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const trialLeadSchema = z.object({
  childName: z.string().min(1, 'Nombre requerido').max(100),
  dateOfBirth: z.string().optional(),
  parentName: z.string().min(1, 'Nombre requerido').max(100),
  parentPhone: z.string().max(20).optional().or(z.literal('')),
  parentEmail: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  trialClassDate: z.string().min(1, 'Fecha requerida'),
  status: z.enum(['trial_scheduled', 'trial_attended', 'enrolled', 'trial_cancelled', 'trial_no_show', 'interested']),
  notes: z.string().max(500).optional(),
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
      trialClassDate: '',
      status: 'trial_scheduled',
      notes: '',
    },
  });

  const addTrialLeadMutation = useMutation({
    mutationFn: async (values: TrialLeadFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('leads').insert({
        child_name: values.childName,
        date_of_birth: values.dateOfBirth || null,
        parent_name: values.parentName,
        phone: values.parentPhone || null,
        email: values.parentEmail || null,
        trial_class_date: values.trialClassDate,
        status: values.status as any,
        notes: values.notes || null,
        source: 'other' as any,
        created_by: user.id,
      }).select().single();

      if (error) throw error;
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
              <CardTitle>Clase de prueba</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="trialClassDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
