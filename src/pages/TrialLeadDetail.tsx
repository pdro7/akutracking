import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Save, UserPlus } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TrialLeadStatus = 'trial_scheduled' | 'trial_attended' | 'enrolled' | 'trial_cancelled' | 'trial_no_show' | 'interested';

interface TrialLead {
  id: string;
  child_name: string;
  date_of_birth: string | null;
  parent_name: string;
  phone: string | null;
  email: string | null;
  trial_class_date: string;
  trial_class_time: string | null;
  notes: string | null;
  trial_objection: string | null;
  trial_teacher_id: string | null;
  trial_course_id: string | null;
  status: TrialLeadStatus;
  created_at: string;
}

const statusColors: Record<TrialLeadStatus, string> = {
  trial_scheduled: 'bg-blue-500/10 text-blue-500',
  trial_attended:  'bg-green-500/10 text-green-500',
  interested:      'bg-teal-500/10 text-teal-600',
  enrolled:        'bg-purple-500/10 text-purple-500',
  trial_cancelled: 'bg-gray-500/10 text-gray-500',
  trial_no_show:   'bg-orange-500/10 text-orange-500',
};

const statusLabels: Record<TrialLeadStatus, string> = {
  trial_scheduled: 'Agendado',
  trial_attended:  'Asistió',
  interested:      'Interesado',
  enrolled:        'Inscrito',
  trial_cancelled: 'Cancelado',
  trial_no_show:   'No asistió',
};

export default function TrialLeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [childName, setChildName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [trialClassDate, setTrialClassDate] = useState('');
  const [trialClassTime, setTrialClassTime] = useState('');
  const [status, setStatus] = useState<TrialLeadStatus>('trial_scheduled');
  const [notes, setNotes] = useState('');
  const [objection, setObjection] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [virtualCourseId, setVirtualCourseId] = useState('');
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  const { data: virtualCourses = [] } = useQuery({
    queryKey: ['virtual_courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('virtual_courses').select('id, code, name').eq('is_active', true).order('code');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['trial-lead', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TrialLead | null;
    },
  });

  useEffect(() => {
    if (lead) {
      setChildName(lead.child_name);
      setDateOfBirth(lead.date_of_birth || '');
      setParentName(lead.parent_name);
      setParentPhone(lead.phone || '');
      setParentEmail(lead.email || '');
      setTrialClassDate(lead.trial_class_date);
      setTrialClassTime(lead.trial_class_time?.slice(0, 5) || '');
      setStatus(lead.status);
      setNotes(lead.notes || '');
      setObjection(lead.trial_objection || '');
      setTeacherId(lead.trial_teacher_id || 'none');
      setVirtualCourseId(lead.trial_course_id || 'none');
    }
  }, [lead]);

  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('leads')
        .update({
          child_name: childName,
          date_of_birth: dateOfBirth || null,
          parent_name: parentName,
          phone: parentPhone || null,
          email: parentEmail || null,
          trial_class_date: trialClassDate,
          trial_class_time: trialClassTime || null,
          status: status as any,
          notes: notes || null,
          trial_teacher_id: teacherId && teacherId !== 'none' ? teacherId : null,
          trial_course_id: virtualCourseId && virtualCourseId !== 'none' ? virtualCourseId : null,
          trial_objection: objection.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['trial-leads'] });
      toast.success('Actualizado correctamente');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const convertToStudentMutation = useMutation({
    mutationFn: async () => {
      const { data: settings } = await supabase
        .from('settings')
        .select('default_pack_size')
        .maybeSingle();

      const defaultPackSize = settings?.default_pack_size || 8;
      const studentEmail = parentEmail || `${parentPhone}@trial-converted.local`;

      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          name: childName,
          email: studentEmail,
          phone: parentPhone,
          parent_name: parentName,
          date_of_birth: dateOfBirth || null,
          notes: notes || null,
          enrollment_date: new Date().toISOString().split('T')[0],
          pack_size: defaultPackSize,
          classes_remaining: defaultPackSize,
        })
        .select()
        .single();

      if (studentError) throw studentError;

      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: 'enrolled', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;

      return newStudent;
    },
    onSuccess: (newStudent) => {
      queryClient.invalidateQueries({ queryKey: ['trial-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['trial-leads'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Lead convertido a alumno correctamente');
      navigate(`/student/${newStudent.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSave = () => {
    if (!childName || !parentName || !trialClassDate) {
      toast.error('Completa los campos requeridos');
      return;
    }
    updateLeadMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Lead no encontrado</h2>
          <Button onClick={() => navigate('/trial-leads')}>Volver</Button>
        </Card>
      </div>
    );
  }

  const age = lead.date_of_birth ? differenceInYears(new Date(), new Date(lead.date_of_birth)) : null;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/trial-leads')} className="gap-2">
          <ArrowLeft size={20} />
          Clases de prueba
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowConvertDialog(true)}
            disabled={status === 'enrolled' || convertToStudentMutation.isPending}
            className="gap-2"
          >
            <UserPlus size={20} />
            Convertir a alumno
          </Button>
          <Button onClick={handleSave} disabled={updateLeadMutation.isPending} className="gap-2">
            <Save size={20} />
            {updateLeadMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{lead.child_name}</h1>
              {age !== null && <p className="text-muted-foreground">{age} años</p>}
            </div>
            <Badge className={statusColors[status] ?? ''} variant="secondary">
              {statusLabels[status] ?? status}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(lead.trial_class_date + 'T12:00:00'), 'PPP')}
                {lead.trial_class_time && ` · ${lead.trial_class_time.slice(0, 5)}`}
              </span>
            </div>
          </div>
        </Card>

        {/* Edit Form */}
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="px-0 space-y-4">
            {/* Row 1: Child name + DOB */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">Nombre del niño/a *</label>
                <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Nombre del niño/a" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Fecha de nacimiento</label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
            </div>

            {/* Row 2: Parent name + phone + email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Padre/madre *</label>
                <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Nombre del padre/madre" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Celular</label>
                <Input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Número de celular" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="Email" />
              </div>
            </div>

            {/* Row 3: Date + time + status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Fecha de la clase *</label>
                <Input type="date" value={trialClassDate} onChange={(e) => setTrialClassDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Hora</label>
                <Input type="time" value={trialClassTime} onChange={(e) => setTrialClassTime(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Estado *</label>
                <Select value={status} onValueChange={(v) => setStatus(v as TrialLeadStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial_scheduled">Agendado</SelectItem>
                    <SelectItem value="trial_attended">Asistió</SelectItem>
                    <SelectItem value="interested">Interesado</SelectItem>
                    <SelectItem value="enrolled">Inscrito</SelectItem>
                    <SelectItem value="trial_cancelled">Cancelado</SelectItem>
                    <SelectItem value="trial_no_show">No asistió</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Course + teacher */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Curso de inicio</label>
                <Select value={virtualCourseId} onValueChange={setVirtualCourseId}>
                  <SelectTrigger><SelectValue placeholder="Sin curso asignado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin curso asignado</SelectItem>
                    {(virtualCourses as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Profesor</label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger><SelectValue placeholder="Sin profesor asignado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin profesor asignado</SelectItem>
                    {(teachers as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notas</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones sobre esta clase de prueba..."
                rows={3}
              />
            </div>

            {/* Objection */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Objeción</label>
              <Textarea
                value={objection}
                onChange={(e) => setObjection(e.target.value)}
                placeholder="Ej: el horario no le cuadra, precio, distancia..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir a alumno?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará un nuevo alumno con la información de este lead y el estado se marcará como inscrito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => convertToStudentMutation.mutate()}>
              {convertToStudentMutation.isPending ? 'Convirtiendo...' : 'Convertir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
