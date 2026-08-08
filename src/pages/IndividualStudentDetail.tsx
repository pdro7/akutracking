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
import { formatWeeklyPattern, generateIndividualSessions, WEEKDAYS, WEEKDAY_LABEL, type WeeklySlot, type WeekDay } from '@/lib/individualSchedule';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { useUserRole, useTeacherRecord } from '@/hooks/useUserRole';

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
  const { data: role } = useUserRole();
  const { data: teacherRecord } = useTeacherRecord();
  const isTeacher = role === 'teacher';

  const [attendSession, setAttendSession] = useState<Session | null>(null);
  const [attendNotes, setAttendNotes] = useState('');

  const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [cancelSession, setCancelSession] = useState<Session | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Renew pack dialog
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [renewPackSize, setRenewPackSize] = useState<number>(8);
  const [renewStartDate, setRenewStartDate] = useState('');

  // Edit schedule dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editPattern, setEditPattern] = useState<WeeklySlot[]>([]);

  const { data: schedule, isLoading: loadingSch } = useQuery({
    // Include isTeacher in the key so the payload can't leak parent PII
    // if the user role changes mid-session.
    queryKey: ['individual_schedule', studentId, isTeacher],
    enabled: !!studentId,
    queryFn: async () => {
      // Teachers never see parent contact info.
      const studentFields = isTeacher
        ? 'id, name, pack_size, classes_remaining'
        : 'id, name, pack_size, classes_remaining, phone, parent_name';
      const { data, error } = await supabase
        .from('individual_schedules')
        .select(`
          id, teacher_id, current_topic, weekly_pattern, is_active,
          student:students!individual_schedules_student_id_fkey(${studentFields}),
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

  // Teachers (for the edit dialog picker) — admin only editing.
  const { data: teachersList = [] } = useQuery({
    queryKey: ['teachers_active_individual_edit'],
    enabled: showEditDialog && !isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Renew pack: generate N sessions from the given start date using the current
  // pattern, reset classes_remaining and pack_size on the student.
  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!schedule || !renewStartDate || renewPackSize <= 0) throw new Error('Datos incompletos');
      const pattern = Array.isArray(schedule.weekly_pattern) ? (schedule.weekly_pattern as unknown as WeeklySlot[]) : [];
      const generated = generateIndividualSessions(renewStartDate, pattern, renewPackSize);
      if (generated.length === 0) throw new Error('No se pudieron generar sesiones con el patrón actual');
      const rows = generated.map((g) => ({
        student_id: studentId!,
        teacher_id: schedule.teacher_id,
        scheduled_date: g.scheduled_date,
        scheduled_start_time: g.scheduled_start_time,
        scheduled_end_time: g.scheduled_end_time,
      }));
      const { error: sesErr } = await supabase.from('individual_sessions').insert(rows);
      if (sesErr) throw sesErr;
      const { error: stErr } = await supabase.from('students').update({
        pack_size: renewPackSize,
        classes_remaining: renewPackSize,
      }).eq('id', studentId!);
      if (stErr) throw stErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individual_sessions', studentId] });
      queryClient.invalidateQueries({ queryKey: ['individual_schedule', studentId] });
      queryClient.invalidateQueries({ queryKey: ['individual_schedules'] });
      setShowRenewDialog(false);
      toast.success('Nuevo pack registrado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit schedule (teacher, topic, weekly pattern).
  const editScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!editPattern.length) throw new Error('El patrón semanal no puede estar vacío');
      const patch: any = {
        current_topic: editTopic.trim() || null,
        weekly_pattern: editPattern as any,
        updated_at: new Date().toISOString(),
      };
      // Admin can also change teacher.
      if (!isTeacher && editTeacherId) patch.teacher_id = editTeacherId;
      const { error } = await supabase.from('individual_schedules').update(patch).eq('student_id', studentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individual_schedule', studentId] });
      queryClient.invalidateQueries({ queryKey: ['individual_schedules'] });
      setShowEditDialog(false);
      toast.success('Configuración actualizada. Las sesiones ya generadas no cambian de fecha.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEditSchedule = () => {
    if (!schedule) return;
    setEditTeacherId(schedule.teacher_id);
    setEditTopic(schedule.current_topic ?? '');
    const pattern = Array.isArray(schedule.weekly_pattern) ? (schedule.weekly_pattern as unknown as WeeklySlot[]) : [];
    setEditPattern(pattern.length ? pattern : [{ day: 'mon', start_time: '16:00', end_time: '17:00' }]);
    setShowEditDialog(true);
  };

  const openRenewPack = () => {
    setRenewPackSize(schedule?.student?.pack_size ?? 8);
    setRenewStartDate(new Date().toISOString().slice(0, 10));
    setShowRenewDialog(true);
  };

  if (loadingSch) {
    return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  }
  if (!schedule) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Este alumno no está configurado como individual.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => navigate(isTeacher ? '/teacher/individuales' : '/individuales')}>Volver</Button>
        </div>
      </div>
    );
  }
  // Teacher can only see their own individual student.
  if (isTeacher && teacherRecord?.id && schedule.teacher_id !== teacherRecord.id) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Este alumno no está asignado a ti.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/teacher/individuales')}>Volver</Button>
        </div>
      </div>
    );
  }

  const pattern = Array.isArray(schedule.weekly_pattern) ? (schedule.weekly_pattern as unknown as WeeklySlot[]) : [];
  const student = schedule.student;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(isTeacher ? '/teacher/individuales' : '/individuales')} className="gap-2 mb-4">
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
            {!isTeacher && student?.parent_name && (
              <div className="text-xs text-muted-foreground mt-1">
                Padre/madre: {student.parent_name}{student.phone && ` · ${student.phone}`}
              </div>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <div className="text-xs text-muted-foreground">Pack</div>
            <div className="text-2xl font-bold">
              {student?.classes_remaining ?? 0}
              <span className="text-sm font-normal text-muted-foreground"> / {student?.pack_size ?? 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">clases restantes</div>
            {!isTeacher && (
              <div className="flex flex-col gap-1 mt-2 w-full max-w-[180px]">
                <Button variant="outline" size="sm" className="gap-1" onClick={openEditSchedule}>
                  <Pencil size={12} /> Editar
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={openRenewPack}>
                  <RefreshCw size={12} /> Nuevo pack
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/student/${studentId}`)}>
                  Ver ficha completa
                </Button>
              </div>
            )}
            {isTeacher && (
              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={openEditSchedule}>
                <Pencil size={12} /> Editar tema/horario
              </Button>
            )}
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

      {/* Renew pack dialog */}
      <Dialog open={showRenewDialog} onOpenChange={(o) => !o && setShowRenewDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo pack para {student?.name}</DialogTitle>
            <DialogDescription>
              Se generan las sesiones del pack desde la fecha indicada usando el patrón semanal actual. El contador de clases restantes se resetea al tamaño del pack nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Pack *</label>
                <Select value={String(renewPackSize)} onValueChange={(v) => setRenewPackSize(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 clases</SelectItem>
                    <SelectItem value="8">8 clases</SelectItem>
                    <SelectItem value="10">10 clases</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Desde *</label>
                <Input type="date" value={renewStartDate} onChange={(e) => setRenewStartDate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Patrón actual: <span className="font-medium">{formatWeeklyPattern(pattern)}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewDialog(false)}>Cancelar</Button>
            <Button onClick={() => renewMutation.mutate()} disabled={renewMutation.isPending || !renewStartDate || !renewPackSize}>
              {renewMutation.isPending ? 'Generando...' : `Generar ${renewPackSize} sesiones`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit schedule dialog */}
      <Dialog open={showEditDialog} onOpenChange={(o) => !o && setShowEditDialog(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar configuración</DialogTitle>
            <DialogDescription>
              Cambios en el patrón semanal solo afectan a las sesiones que se generen después. Las ya programadas no cambian de fecha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!isTeacher && (
              <div>
                <label className="text-xs font-medium block mb-1">Profesor</label>
                <Select value={editTeacherId} onValueChange={setEditTeacherId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(teachersList as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium block mb-1">Tema actual</label>
              <Input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} placeholder="Ej: Python básico, Scratch avanzado..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium">Patrón semanal</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditPattern([...editPattern, { day: 'mon', start_time: '16:00', end_time: '17:00' }])}
                >
                  <Plus size={12} /> Añadir día
                </Button>
              </div>
              <div className="space-y-2">
                {editPattern.map((slot, i) => (
                  <div key={i} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center">
                    <Select value={slot.day} onValueChange={(v) => {
                      const next = [...editPattern]; next[i] = { ...slot, day: v as WeekDay }; setEditPattern(next);
                    }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d) => (
                          <SelectItem key={d} value={d}>{WEEKDAY_LABEL[d]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="time" value={slot.start_time} onChange={(e) => {
                      const next = [...editPattern]; next[i] = { ...slot, start_time: e.target.value }; setEditPattern(next);
                    }} />
                    <Input type="time" value={slot.end_time ?? ''} onChange={(e) => {
                      const next = [...editPattern]; next[i] = { ...slot, end_time: e.target.value || null }; setEditPattern(next);
                    }} placeholder="Fin (opcional)" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditPattern(editPattern.filter((_, j) => j !== i))}
                      disabled={editPattern.length === 1}
                      className="h-9 w-9"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={() => editScheduleMutation.mutate()} disabled={editScheduleMutation.isPending || editPattern.length === 0}>
              {editScheduleMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
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
