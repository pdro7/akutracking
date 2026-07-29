import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, XCircle, CalendarClock, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatWeeklyPattern, type WeeklySlot } from '@/lib/individualSchedule';

type Session = {
  id: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  status: 'scheduled' | 'attended' | 'cancelled_by_parent' | 'no_show';
  notes: string | null;
  original_date: string | null;
  original_time: string | null;
  reschedule_reason: string | null;
  cancel_reason: string | null;
};

const STATUS_LABEL: Record<Session['status'], { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' }> = {
  scheduled:           { label: 'Agendada',       variant: 'warning' },
  attended:            { label: 'Asistió',        variant: 'success' },
  cancelled_by_parent: { label: 'Cancelada',      variant: 'outline' },
  no_show:             { label: 'No asistió',     variant: 'destructive' },
};

export default function IndividualStudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [attendSession, setAttendSession] = useState<Session | null>(null);
  const [attendNotes, setAttendNotes] = useState('');

  const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [cancelSession, setCancelSession] = useState<Session | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data: schedule, isLoading: loadingSch } = useQuery({
    queryKey: ['individual_schedule', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('individual_schedules')
        .select(`
          id, teacher_id, current_topic, weekly_pattern, is_active,
          student:students!individual_schedules_student_id_fkey(id, name, pack_size, classes_remaining, phone, parent_name),
          teacher:teachers!individual_schedules_teacher_id_fkey(id, name)
        `)
        .eq('student_id', studentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['individual_sessions', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('individual_sessions')
        .select('id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, original_date, original_time, reschedule_reason, cancel_reason')
        .eq('student_id', studentId!)
        .order('scheduled_date')
        .order('scheduled_start_time');
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () => sessions.filter((s) => s.status === 'scheduled' && s.scheduled_date >= today),
    [sessions, today],
  );
  const history = useMemo(
    () => sessions
      .filter((s) => !(s.status === 'scheduled' && s.scheduled_date >= today))
      .sort((a, b) => (b.scheduled_date + b.scheduled_start_time).localeCompare(a.scheduled_date + a.scheduled_start_time)),
    [sessions, today],
  );

  const attendMutation = useMutation({
    mutationFn: async () => {
      if (!attendSession || !schedule) return;
      const { error: sesErr } = await supabase
        .from('individual_sessions')
        .update({ status: 'attended', notes: attendNotes.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', attendSession.id);
      if (sesErr) throw sesErr;
      // Decrement student's classes_remaining, bump classes_attended.
      const currentRemaining = schedule.student?.classes_remaining ?? 0;
      const { error: stErr } = await supabase
        .from('students')
        .update({ classes_remaining: Math.max(0, currentRemaining - 1) })
        .eq('id', studentId!);
      if (stErr) throw stErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individual_sessions', studentId] });
      queryClient.invalidateQueries({ queryKey: ['individual_schedule', studentId] });
      queryClient.invalidateQueries({ queryKey: ['individual_schedules'] });
      toast.success('Asistencia registrada');
      setAttendSession(null);
      setAttendNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!rescheduleSession) return;
      if (!rescheduleDate) throw new Error('Nueva fecha es obligatoria');
      const patch: any = {
        scheduled_date: rescheduleDate,
        scheduled_start_time: rescheduleTime || rescheduleSession.scheduled_start_time,
        reschedule_reason: rescheduleReason.trim() || null,
        updated_at: new Date().toISOString(),
      };
      // Preserve original only on first reschedule.
      if (!rescheduleSession.original_date) {
        patch.original_date = rescheduleSession.scheduled_date;
        patch.original_time = rescheduleSession.scheduled_start_time;
      }
      const { error } = await supabase.from('individual_sessions').update(patch).eq('id', rescheduleSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individual_sessions', studentId] });
      toast.success('Sesión reagendada');
      setRescheduleSession(null);
      setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelSession) return;
      const { error } = await supabase
        .from('individual_sessions')
        .update({
          status: 'cancelled_by_parent',
          cancel_reason: cancelReason.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cancelSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individual_sessions', studentId] });
      toast.success('Sesión marcada como cancelada (no descuenta del pack)');
      setCancelSession(null);
      setCancelReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noShowMutation = useMutation({
    mutationFn: async (session: Session) => {
      const { error: sesErr } = await supabase
        .from('individual_sessions')
        .update({ status: 'no_show', updated_at: new Date().toISOString() })
        .eq('id', session.id);
      if (sesErr) throw sesErr;
      // No-show DOES consume a class from the pack.
      const currentRemaining = schedule?.student?.classes_remaining ?? 0;
      const { error: stErr } = await supabase
        .from('students')
        .update({ classes_remaining: Math.max(0, currentRemaining - 1) })
        .eq('id', studentId!);
      if (stErr) throw stErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individual_sessions', studentId] });
      queryClient.invalidateQueries({ queryKey: ['individual_schedule', studentId] });
      toast.success('Sesión marcada como no asistió (descuenta 1 del pack)');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingSch) {
    return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  }
  if (!schedule) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Este alumno no está configurado como individual.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/individuales')}>Volver</Button>
        </div>
      </div>
    );
  }

  const pattern = Array.isArray(schedule.weekly_pattern) ? (schedule.weekly_pattern as unknown as WeeklySlot[]) : [];
  const student = schedule.student;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/individuales')} className="gap-2 mb-4">
        <ArrowLeft size={14} /> Volver a individuales
      </Button>

      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User size={22} /> {student?.name}
            </h1>
            <div className="text-sm text-muted-foreground mt-1">
              Profesor: <span className="font-medium text-foreground">{schedule.teacher?.name ?? '—'}</span>
              {schedule.current_topic && <> · Tema: <span className="font-medium text-foreground">{schedule.current_topic}</span></>}
            </div>
            <div className="text-sm mt-2">
              <span className="text-muted-foreground">Horario semanal: </span>
              <span className="font-medium">{formatWeeklyPattern(pattern)}</span>
            </div>
            {student?.parent_name && (
              <div className="text-xs text-muted-foreground mt-1">
                Padre/madre: {student.parent_name}{student.phone && ` · ${student.phone}`}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">Pack</div>
            <div className="text-2xl font-bold">
              {student?.classes_remaining ?? 0}
              <span className="text-sm font-normal text-muted-foreground"> / {student?.pack_size ?? 0}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">clases restantes</div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate(`/student/${studentId}`)}>
              Ver ficha completa
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Próximas sesiones ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Sin sesiones programadas por ahora.
            </Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onAttend={() => { setAttendSession(s); setAttendNotes(s.notes ?? ''); }}
                  onReschedule={() => {
                    setRescheduleSession(s);
                    setRescheduleDate(s.scheduled_date);
                    setRescheduleTime(s.scheduled_start_time.slice(0, 5));
                    setRescheduleReason('');
                  }}
                  onCancel={() => { setCancelSession(s); setCancelReason(''); }}
                  onNoShow={() => noShowMutation.mutate(s)}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Historial ({history.length})</h2>
          {history.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Sin historial todavía.</Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {history.map((s) => (
                <SessionRow key={s.id} session={s} readOnly onAttend={() => {}} onReschedule={() => {}} onCancel={() => {}} onNoShow={() => {}} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attend dialog */}
      <Dialog open={!!attendSession} onOpenChange={(o) => !o && setAttendSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar asistencia</DialogTitle>
            <DialogDescription>Se descuenta 1 clase del pack.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium block mb-1">Qué se hizo en la clase (opcional)</label>
            <Textarea rows={3} value={attendNotes} onChange={(e) => setAttendNotes(e.target.value)} placeholder="Temas trabajados, avances, ejercicios..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendSession(null)}>Cancelar</Button>
            <Button onClick={() => attendMutation.mutate()} disabled={attendMutation.isPending}>
              {attendMutation.isPending ? 'Guardando...' : 'Marcar asistió'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleSession} onOpenChange={(o) => !o && setRescheduleSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reagendar sesión</DialogTitle>
            {rescheduleSession && (
              <DialogDescription>
                Actual: {new Date(rescheduleSession.scheduled_date + 'T12:00:00').toLocaleDateString('es-CO')} · {rescheduleSession.scheduled_start_time.slice(0, 5)}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Nueva fecha *</label>
                <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Nueva hora</label>
                <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Motivo (opcional)</label>
              <Textarea rows={2} value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} placeholder="Ej: compromiso familiar, enfermedad..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleSession(null)}>Cancelar</Button>
            <Button onClick={() => rescheduleMutation.mutate()} disabled={!rescheduleDate || rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? 'Guardando...' : 'Reagendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelSession} onOpenChange={(o) => !o && setCancelSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar sesión</DialogTitle>
            <DialogDescription>
              La clase se pierde esta vez pero <b>no descuenta del pack</b>. La siguiente fecha del patrón sigue en pie.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium block mb-1">Motivo (opcional)</label>
            <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ej: enfermedad, viaje..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelSession(null)}>Cerrar</Button>
            <Button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Guardando...' : 'Cancelar sesión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionRow({ session, readOnly = false, onAttend, onReschedule, onCancel, onNoShow }: {
  session: Session;
  readOnly?: boolean;
  onAttend: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const cfg = STATUS_LABEL[session.status];
  const dateStr = format(new Date(session.scheduled_date + 'T12:00:00'), "EEE d MMM", { locale: es });
  const timeStr = session.scheduled_start_time.slice(0, 5);
  const wasMoved = !!session.original_date;

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium capitalize">{dateStr}</span>
            <span className="text-sm font-mono text-muted-foreground">· {timeStr}</span>
            <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
            {wasMoved && (
              <span className="text-[10px] text-muted-foreground italic">
                (movida desde {new Date(session.original_date! + 'T12:00:00').toLocaleDateString('es-CO')}{session.original_time ? ` ${session.original_time.slice(0, 5)}` : ''})
              </span>
            )}
          </div>
          {session.notes && (
            <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{session.notes}</div>
          )}
          {session.reschedule_reason && (
            <div className="text-xs italic text-muted-foreground mt-1">Reagenda: «{session.reschedule_reason}»</div>
          )}
          {session.cancel_reason && (
            <div className="text-xs italic text-muted-foreground mt-1">Cancelación: «{session.cancel_reason}»</div>
          )}
        </div>
        {!readOnly && session.status === 'scheduled' && (
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" variant="default" className="h-7 gap-1" onClick={onAttend}>
              <CheckCircle2 size={12} /> Asistió
            </Button>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 gap-1 flex-1" onClick={onReschedule} title="Reagendar">
                <CalendarClock size={12} />
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 flex-1" onClick={onCancel} title="Cancelar (no descuenta)">
                <XCircle size={12} />
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 flex-1" onClick={onNoShow} title="No asistió (descuenta)">
                NS
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
