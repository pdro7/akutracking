import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserPlus, MessageCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'trial_attended' | 'trial_no_show' | 'trial_cancelled' | 'enrolled' | 'lost' | 'interested';
type LeadSource = 'whatsapp' | 'google_organic' | 'web' | 'calendly' | 'referral' | 'other' | 'reactivation';

const STATUS_CONFIG: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  new:              { label: 'Nuevo',            variant: 'secondary' },
  contacted:        { label: 'Contactado',       variant: 'default' },
  interested:       { label: 'Interesado',       variant: 'default' },
  trial_scheduled:  { label: 'Prueba agendada',  variant: 'warning' },
  trial_attended:   { label: 'Prueba realizada', variant: 'warning' },
  trial_no_show:    { label: 'No asistió',       variant: 'destructive' },
  trial_cancelled:  { label: 'Prueba cancelada', variant: 'outline' },
  enrolled:         { label: 'Inscrito',         variant: 'success' },
  lost:             { label: 'Perdido',          variant: 'destructive' },
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp:       'WhatsApp',
  google_organic: 'Google orgánico',
  web:            'Web',
  calendly:       'Calendly',
  referral:       'Referido',
  other:          'Otro',
  reactivation:   'Reactivación',
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newNote, setNewNote] = useState('');
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editChildName, setEditChildName] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editCourseInterest, setEditCourseInterest] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTrialClassDate, setEditTrialClassDate] = useState('');
  const [editTrialClassTime, setEditTrialClassTime] = useState('');
  const [editTrialTeacherId, setEditTrialTeacherId] = useState('');
  const [editTrialCourseId, setEditTrialCourseId] = useState('');
  const [editTrialObjection, setEditTrialObjection] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, trial_teacher:teachers!trial_teacher_id(name), trial_course:virtual_courses!trial_course_id(code, name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: conversation } = useQuery({
    queryKey: ['whatsapp_conversation', id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('whatsapp_conversations')
        .select('messages, created_at')
        .eq('lead_id', id!)
        .maybeSingle();
      return data as { messages: { role: string; content: string; image_url?: string }[]; created_at: string } | null;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['lead_notes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: virtualCourses = [] } = useQuery({
    queryKey: ['virtual_courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('virtual_courses').select('id, code, name').eq('is_active', true).order('code');
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('leads').update({ status: status as any, updated_at: new Date().toISOString() }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads_counts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!newNote.trim()) throw new Error('Escribe una nota');
      const { error } = await supabase.from('lead_notes').insert({ lead_id: id!, content: newNote.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_notes', id] });
      setNewNote('');
      toast.success('Nota añadida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update({
        child_name: editChildName.trim(),
        parent_name: editParentName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        date_of_birth: editDateOfBirth || null,
        source: editSource as any,
        course_interest: editCourseInterest.trim() || null,
        notes: editNotes.trim() || null,
        trial_class_date: editTrialClassDate || null,
        trial_class_time: editTrialClassTime || null,
        trial_teacher_id: editTrialTeacherId && editTrialTeacherId !== 'none' ? editTrialTeacherId : null,
        trial_course_id: editTrialCourseId && editTrialCourseId !== 'none' ? editTrialCourseId : null,
        trial_objection: editTrialObjection.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      setEditing(false);
      toast.success('Lead actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startConversationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('start-conversation', {
        body: { lead_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp_conversation', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Pablo ha iniciado la conversación con el padre');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error('Lead no encontrado');
      const { error: studentError } = await supabase.from('students').insert({
        name: lead.child_name,
        parent_name: lead.parent_name,
        phone: lead.phone,
        email: lead.email || '',
        date_of_birth: lead.date_of_birth || null,
        enrollment_date: new Date().toISOString().split('T')[0],
        modality: 'virtual',
        is_active: true,
        newsletter_opt_in: false,
        pack_size: 8,
        classes_attended: 0,
        classes_remaining: 8,
      });
      if (studentError) throw studentError;
      await supabase.from('leads').update({ status: 'enrolled' as any, updated_at: new Date().toISOString() }).eq('id', id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads_counts'] });
      setShowConvertDialog(false);
      toast.success('Lead convertido a alumno');
      navigate('/students');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = () => {
    if (!lead) return;
    setEditChildName(lead.child_name);
    setEditParentName(lead.parent_name);
    setEditPhone(lead.phone || '');
    setEditEmail(lead.email || '');
    setEditDateOfBirth(lead.date_of_birth || '');
    setEditSource(lead.source);
    setEditCourseInterest(lead.course_interest || '');
    setEditNotes(lead.notes || '');
    setEditTrialClassDate(lead.trial_class_date || '');
    setEditTrialClassTime(lead.trial_class_time?.slice(0, 5) || '');
    setEditTrialTeacherId(lead.trial_teacher_id || 'none');
    setEditTrialCourseId(lead.trial_course_id || 'none');
    setEditTrialObjection(lead.trial_objection || '');
    setEditing(true);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (!lead) return <div className="p-8 text-center text-muted-foreground">Lead no encontrado</div>;

  const hasTrial = !!lead.trial_class_date;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-2 mb-6">
        <ArrowLeft size={16} />
        Volver a Leads
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{lead.child_name}</h1>
          <p className="text-muted-foreground">{lead.parent_name} · {lead.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          {!conversation && lead.status !== 'enrolled' && (
            <Button
              variant="outline"
              className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => startConversationMutation.mutate()}
              disabled={startConversationMutation.isPending}
            >
              <MessageCircle size={16} />
              {startConversationMutation.isPending ? 'Iniciando...' : 'Iniciar con Pablo'}
            </Button>
          )}
          {lead.status !== 'enrolled' && (
            <Button variant="outline" className="gap-2" onClick={() => setShowConvertDialog(true)}>
              <UserPlus size={16} />
              Convertir a alumno
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={openEdit}>Editar</Button>
        </div>
      </div>

      {/* Pipeline status selector */}
      <Card className="p-4 mb-4">
        <Label className="mb-3 block text-sm font-medium">Estado del pipeline</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([status, config]) => (
            <button
              key={status}
              onClick={() => updateStatusMutation.mutate(status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                lead.status === status
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </Card>

      {/* General info */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Fuente</p>
            <p className="font-medium">{SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Curso de interés</p>
            <p className="font-medium">{lead.course_interest || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{lead.email || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de nacimiento</p>
            <p className="font-medium">{lead.date_of_birth ? new Date(lead.date_of_birth + 'T12:00:00').toLocaleDateString('es-CO') : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Registrado</p>
            <p className="font-medium">{new Date(lead.created_at).toLocaleDateString('es-CO')}</p>
          </div>
          {lead.notes && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Notas</p>
              <p className="font-medium whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Trial class section */}
      {hasTrial && (
        <Card className="p-4 mb-4">
          <h2 className="font-semibold mb-3 text-sm">Clase de prueba</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Fecha y hora</p>
              <p className="font-medium">
                {new Date(lead.trial_class_date + 'T12:00:00').toLocaleDateString('es-CO')}
                {lead.trial_class_time && ` · ${lead.trial_class_time.slice(0, 5)}`}
              </p>
            </div>
            {lead.trial_teacher?.name && (
              <div>
                <p className="text-muted-foreground">Profesor</p>
                <p className="font-medium">{lead.trial_teacher.name}</p>
              </div>
            )}
            {lead.trial_course?.code && (
              <div>
                <p className="text-muted-foreground">Curso asignado</p>
                <p className="font-medium">{lead.trial_course.code} — {lead.trial_course.name}</p>
              </div>
            )}
            {lead.trial_objection && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Objeción</p>
                <p className="font-medium">{lead.trial_objection}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* WhatsApp conversation */}
      {conversation && (conversation.messages as any[]).length > 0 && (
        <Card className="p-4 mb-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <span className="text-green-600">💬</span> Conversación con Pablo
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {(conversation.messages as { role: string; content: string; image_url?: string }[]).map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  msg.role === 'assistant'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-muted rounded-bl-none'
                }`}>
                  {msg.image_url && (
                    <img src={msg.image_url} alt="Imagen enviada" className="max-w-full rounded-lg mb-1" />
                  )}
                  {msg.content && msg.content !== '[Imagen]' && msg.content}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes history */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Historial de seguimiento</h2>
        <div className="flex gap-2 mb-4">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Añadir nota de seguimiento..."
            rows={2}
            className="resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey && newNote.trim()) addNoteMutation.mutate(); }}
          />
          <Button
            onClick={() => addNoteMutation.mutate()}
            disabled={!newNote.trim() || addNoteMutation.isPending}
            className="self-end"
          >
            Añadir
          </Button>
        </div>
        {(notes as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin notas todavía</p>
        ) : (
          <div className="space-y-3">
            {(notes as any[]).map((note: any) => (
              <div key={note.id} className="border-l-2 border-primary/30 pl-3 py-1">
                <p className="text-sm">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(note.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={(o) => !o && setEditing(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Nombre del niño</Label>
                <Input value={editChildName} onChange={(e) => setEditChildName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Fecha de nacimiento</Label>
                <Input type="date" value={editDateOfBirth} onChange={(e) => setEditDateOfBirth(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Nombre padre/madre</Label>
                <Input value={editParentName} onChange={(e) => setEditParentName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Teléfono</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Fuente</Label>
                <Select value={editSource} onValueChange={setEditSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="google_organic">Google orgánico</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="calendly">Calendly</SelectItem>
                    <SelectItem value="referral">Referido</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                    <SelectItem value="reactivation">Reactivación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Curso de interés</Label>
                <Input value={editCourseInterest} onChange={(e) => setEditCourseInterest(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Notas</Label>
              <Textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notas generales..." />
            </div>

            {/* Trial section */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Clase de prueba</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Fecha</Label>
                  <Input type="date" value={editTrialClassDate} onChange={(e) => setEditTrialClassDate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block">Hora</Label>
                  <Input type="time" value={editTrialClassTime} onChange={(e) => setEditTrialClassTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="mb-1 block">Profesor</Label>
                  <Select value={editTrialTeacherId} onValueChange={setEditTrialTeacherId}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {(teachers as any[]).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">Curso asignado</Label>
                  <Select value={editTrialCourseId} onValueChange={setEditTrialCourseId}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {(virtualCourses as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label className="mb-1 block">Objeción</Label>
                <Textarea
                  rows={2}
                  value={editTrialObjection}
                  onChange={(e) => setEditTrialObjection(e.target.value)}
                  placeholder="Ej: precio, horario, distancia..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={() => saveEditMutation.mutate()} disabled={saveEditMutation.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Convertir a alumno</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Se creará un nuevo alumno con los datos de <strong>{lead.child_name}</strong>. El lead quedará marcado como "Inscrito".
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancelar</Button>
            <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? 'Convirtiendo...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
