import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function NewLead() {
  const navigate = useNavigate();

  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [source, setSource] = useState('whatsapp');
  const [courseInterest, setCourseInterest] = useState('');
  const [trialClassDate, setTrialClassDate] = useState('');
  const [initialNote, setInitialNote] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!childName.trim() || !parentName.trim() || !phone.trim()) {
        throw new Error('Nombre del niño, nombre del padre y teléfono son obligatorios');
      }
      const status = trialClassDate ? 'trial_scheduled' : 'new';
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          child_name: childName.trim(),
          parent_name: parentName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          date_of_birth: dateOfBirth || null,
          source: source as any,
          status: status as any,
          course_interest: courseInterest.trim() || null,
          trial_class_date: trialClassDate || null,
        })
        .select()
        .single();
      if (error) throw error;
      if (initialNote.trim()) {
        await supabase.from('lead_notes').insert({
          lead_id: lead.id,
          content: initialNote.trim(),
        });
      }
      return lead;
    },
    onSuccess: (lead) => {
      toast.success('Lead registrado');
      navigate(`/leads/${lead.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-2 mb-6">
        <ArrowLeft size={16} />
        Volver a Leads
      </Button>

      <h1 className="text-2xl font-bold mb-6">Nuevo lead</h1>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Nombre del niño *</Label>
            <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div>
            <Label className="mb-2 block">Fecha de nacimiento</Label>
            <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Nombre del padre/madre *</Label>
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div>
            <Label className="mb-2 block">Teléfono *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+57 300 000 0000" />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Fuente *</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="google_organic">Google orgánico</SelectItem>
                <SelectItem value="web">Web (botón)</SelectItem>
                <SelectItem value="calendly">Calendly</SelectItem>
                <SelectItem value="referral">Referido</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Curso de interés</Label>
            <Input value={courseInterest} onChange={(e) => setCourseInterest(e.target.value)} placeholder="Ej: Scratch, Robótica..." />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Fecha clase de prueba (opcional)</Label>
          <Input type="date" value={trialClassDate} onChange={(e) => setTrialClassDate(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">Si se asigna, el estado será "Prueba agendada" automáticamente.</p>
        </div>

        <div>
          <Label className="mb-2 block">Nota inicial</Label>
          <Textarea
            value={initialNote}
            onChange={(e) => setInitialNote(e.target.value)}
            placeholder="Ej: Le interesa Scratch para su hijo de 8 años, busca clases los sábados..."
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => navigate('/leads')}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Guardando...' : 'Guardar lead'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
