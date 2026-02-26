import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle, Users, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  forming:   { label: 'Formando',   variant: 'secondary' },
  active:    { label: 'Activo',     variant: 'success' },
  completed: { label: 'Completado', variant: 'outline' },
  cancelled: { label: 'Cancelado',  variant: 'destructive' },
};

export default function VirtualGroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Enroll dialog
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollPaymentPlan, setEnrollPaymentPlan] = useState('full');
  const [enrollInst1Amount, setEnrollInst1Amount] = useState('');
  const [enrollInst1Date, setEnrollInst1Date] = useState('');
  const [enrollInst2Amount, setEnrollInst2Amount] = useState('');
  const [enrollInst2DueDate, setEnrollInst2DueDate] = useState('');
  const [enrollNotes, setEnrollNotes] = useState('');
  const [removeEnrollmentId, setRemoveEnrollmentId] = useState<string | null>(null);

  // Session attendance dialog
  const [attendanceSession, setAttendanceSession] = useState<any>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});

  const { data: group, isLoading } = useQuery({
    queryKey: ['course_group', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_groups')
        .select('*, virtual_courses(code, name)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['course_sessions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_sessions')
        .select('*')
        .eq('group_id', id)
        .order('session_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['course_enrollments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*, students(id, name, email)')
        .eq('group_id', id)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['students_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('is_active', true)
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Session attendance counts
  const { data: sessionAttendanceCounts = {} } = useQuery({
    queryKey: ['session_attendance_counts', id],
    queryFn: async () => {
      if ((sessions as any[]).length === 0) return {};
      const sessionIds = (sessions as any[]).map((s: any) => s.id);
      const { data, error } = await supabase
        .from('attendance_records')
        .select('course_session_id, attended')
        .in('course_session_id', sessionIds);
      if (error) throw error;
      const counts: Record<string, { present: number; total: number }> = {};
      (data || []).forEach((r: any) => {
        if (!r.course_session_id) return;
        if (!counts[r.course_session_id]) counts[r.course_session_id] = { present: 0, total: 0 };
        counts[r.course_session_id].total++;
        if (r.attended) counts[r.course_session_id].present++;
      });
      return counts;
    },
    enabled: (sessions as any[]).length > 0,
  });

  // Existing attendance for a session
  const { data: sessionAttendanceRecords = [] } = useQuery({
    queryKey: ['session_attendance', attendanceSession?.id],
    queryFn: async () => {
      if (!attendanceSession) return [];
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('course_session_id', attendanceSession.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!attendanceSession,
  });

  const updateGroupStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('course_groups')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course_group', id] });
      queryClient.invalidateQueries({ queryKey: ['course_groups'] });
      toast.success('Estado actualizado');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!enrollStudentId) throw new Error('Selecciona un alumno');
      const payload: any = {
        student_id: enrollStudentId,
        group_id: id,
        payment_plan: enrollPaymentPlan,
        notes: enrollNotes.trim() || null,
      };
      if (enrollPaymentPlan === 'installments') {
        payload.installment_1_amount = enrollInst1Amount ? parseFloat(enrollInst1Amount) : null;
        payload.installment_1_paid_at = enrollInst1Date || null;
        payload.installment_2_amount = enrollInst2Amount ? parseFloat(enrollInst2Amount) : null;
        payload.installment_2_due_date = enrollInst2DueDate || null;
      }
      const { error } = await supabase.from('course_enrollments').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course_enrollments', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollment_counts'] });
      toast.success('Alumno inscrito');
      setShowEnrollDialog(false);
      resetEnrollForm();
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const removeEnrollmentMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'withdrawn' })
        .eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course_enrollments', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollment_counts'] });
      toast.success('Alumno retirado');
      setRemoveEnrollmentId(null);
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const saveSessionAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceSession) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch previous records before deleting to compute the delta
      const { data: prevRecords } = await supabase
        .from('attendance_records')
        .select('student_id, attended')
        .eq('course_session_id', attendanceSession.id);

      const prevMap: Record<string, boolean> = {};
      (prevRecords ?? []).forEach((r: any) => { prevMap[r.student_id] = r.attended; });

      // Delete existing records for this session
      await supabase
        .from('attendance_records')
        .delete()
        .eq('course_session_id', attendanceSession.id);

      // Insert new records
      const records = Object.entries(attendanceMap).map(([studentId, attended]) => ({
        student_id: studentId,
        date: attendanceSession.scheduled_date,
        attended,
        marked_by: user.id,
        course_session_id: attendanceSession.id,
        is_makeup: false,
      }));

      if (records.length > 0) {
        const { error } = await supabase.from('attendance_records').insert(records);
        if (error) throw error;
      }

      // Update classes_remaining / classes_attended for each student whose
      // attendance status changed in this session
      const allStudentIds = new Set([
        ...Object.keys(prevMap),
        ...Object.keys(attendanceMap),
      ]);

      for (const studentId of allStudentIds) {
        const wasPresent = prevMap[studentId] ?? false;
        const isPresent  = attendanceMap[studentId] ?? false;
        if (wasPresent === isPresent) continue;

        const { data: stu } = await supabase
          .from('students')
          .select('classes_attended, classes_remaining')
          .eq('id', studentId)
          .single();
        if (!stu) continue;

        const delta = isPresent ? 1 : -1;
        await supabase.from('students').update({
          classes_attended:  stu.classes_attended  + delta,
          classes_remaining: stu.classes_remaining - delta,
        }).eq('id', studentId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session_attendance_counts', id] });
      queryClient.invalidateQueries({ queryKey: ['session_attendance', attendanceSession?.id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Asistencia guardada');
      setAttendanceSession(null);
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetEnrollForm = () => {
    setEnrollStudentId('');
    setEnrollPaymentPlan('full');
    setEnrollInst1Amount('');
    setEnrollInst1Date('');
    setEnrollInst2Amount('');
    setEnrollInst2DueDate('');
    setEnrollNotes('');
  };

  const handleOpenAttendance = (session: any) => {
    setAttendanceSession(session);
    // Pre-populate from existing records
    const map: Record<string, boolean> = {};
    const activeEnrollments = (enrollments as any[]).filter((e: any) => e.status === 'active');
    activeEnrollments.forEach((e: any) => {
      const existing = (sessionAttendanceRecords as any[]).find(
        (r: any) => r.student_id === e.student_id && r.course_session_id === session.id
      );
      map[e.student_id] = existing ? existing.attended : true;
    });
    setAttendanceMap(map);
  };

  const enrolledStudentIds = new Set(
    (enrollments as any[]).filter((e: any) => e.status === 'active').map((e: any) => e.student_id)
  );
  const availableStudents = (allStudents as any[]).filter((s: any) => !enrolledStudentIds.has(s.id));
  const activeEnrollments = (enrollments as any[]).filter((e: any) => e.status === 'active');

  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const upcomingInstallments = (enrollments as any[]).filter((e: any) => {
    if (e.payment_plan !== 'installments' || e.installment_2_paid_at || !e.installment_2_due_date) return false;
    const due = new Date(e.installment_2_due_date + 'T12:00:00');
    return due <= sevenDaysFromNow;
  });

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Grupo no encontrado</h2>
          <Button onClick={() => navigate('/virtual-groups')}>Volver</Button>
        </Card>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[group.status] ?? { label: group.status, variant: 'secondary' as const };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/virtual-groups')} className="mb-6 gap-2">
        <ArrowLeft size={20} />
        Grupos virtuales
      </Button>

      {/* Header */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold font-mono">{group.code}</h1>
              <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
            </div>
            <p className="text-lg text-muted-foreground">{(group as any).virtual_courses?.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Inicio: {new Date(group.start_date + 'T12:00:00').toLocaleDateString('es-CO')}
              {group.end_date && ` · Fin: ${new Date(group.end_date + 'T12:00:00').toLocaleDateString('es-CO')}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Cambiar estado:</Label>
            <Select value={group.status} onValueChange={(v) => updateGroupStatusMutation.mutate(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forming">Formando</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {group.notes && (
          <p className="mt-3 text-sm text-muted-foreground border-t pt-3">{group.notes}</p>
        )}
      </Card>

      {/* Upcoming installment alerts */}
      {upcomingInstallments.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            Cuotas próximas a vencer ({upcomingInstallments.length}):
          </p>
          {upcomingInstallments.map((e: any) => (
            <p key={e.id} className="text-sm text-yellow-700">
              • {e.students?.name} — vence {new Date(e.installment_2_due_date + 'T12:00:00').toLocaleDateString('es-CO')}
            </p>
          ))}
        </div>
      )}

      <Tabs defaultValue="students">
        <TabsList className="mb-6">
          <TabsTrigger value="students" className="gap-2">
            <Users size={16} />
            Alumnos ({activeEnrollments.length})
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Calendar size={16} />
            Sesiones ({(sessions as any[]).length})
          </TabsTrigger>
        </TabsList>

        {/* ── Alumnos tab ─────────────────────────────────────── */}
        <TabsContent value="students">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Alumnos inscritos</h2>
              <Button size="sm" className="gap-2" onClick={() => setShowEnrollDialog(true)}>
                <Plus size={16} />
                Inscribir alumno
              </Button>
            </div>

            {activeEnrollments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay alumnos inscritos aún</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Plan de pago</TableHead>
                    <TableHead>1ª cuota</TableHead>
                    <TableHead>2ª cuota vence</TableHead>
                    <TableHead>2ª cuota pagada</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeEnrollments.map((enrollment: any) => {
                    const inst2Due = enrollment.installment_2_due_date
                      ? new Date(enrollment.installment_2_due_date + 'T12:00:00')
                      : null;
                    const isOverdue = inst2Due && !enrollment.installment_2_paid_at && inst2Due <= sevenDaysFromNow;

                    return (
                      <TableRow key={enrollment.id}>
                        <TableCell
                          className="font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => navigate(`/student/${enrollment.student_id}`)}
                        >
                          {enrollment.students?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={enrollment.payment_plan === 'full' ? 'success' : 'warning'}>
                            {enrollment.payment_plan === 'full' ? 'Pago completo' : 'Cuotas'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {enrollment.installment_1_paid_at
                            ? new Date(enrollment.installment_1_paid_at + 'T12:00:00').toLocaleDateString('es-CO')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {inst2Due ? (
                            <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                              {inst2Due.toLocaleDateString('es-CO')}
                              {isOverdue && !enrollment.installment_2_paid_at && ' ⚠️'}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {enrollment.installment_2_paid_at
                            ? new Date(enrollment.installment_2_paid_at + 'T12:00:00').toLocaleDateString('es-CO')
                            : enrollment.payment_plan === 'installments' ? <span className="text-muted-foreground">Pendiente</span> : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveEnrollmentId(enrollment.id)}
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Sesiones tab ──────────────────────────────────────── */}
        <TabsContent value="sessions">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Sesiones del curso</h2>

            {(sessions as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay sesiones. Puedes crearlas al crear el grupo o añadirlas manualmente.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sesión</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Asistencia</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sessions as any[]).map((session: any) => {
                    const counts = (sessionAttendanceCounts as any)[session.id];
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">Sesión {session.session_number}</TableCell>
                        <TableCell>
                          {new Date(session.scheduled_date + 'T12:00:00').toLocaleDateString('es-CO', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {counts
                            ? `${counts.present}/${counts.total} presentes`
                            : <span className="text-muted-foreground text-sm">Sin registrar</span>}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Load attendance before opening
                              handleOpenAttendance(session);
                            }}
                          >
                            Marcar asistencia
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Enroll Dialog ─────────────────────────────────────── */}
      <Dialog open={showEnrollDialog} onOpenChange={(open) => { if (!open) { setShowEnrollDialog(false); resetEnrollForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inscribir alumno</DialogTitle>
            <DialogDescription>Añade un alumno al grupo {group.code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="mb-2 block">Alumno *</Label>
              <Select value={enrollStudentId} onValueChange={setEnrollStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un alumno..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Plan de pago</Label>
              <Select value={enrollPaymentPlan} onValueChange={setEnrollPaymentPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Pago completo</SelectItem>
                  <SelectItem value="installments">En cuotas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {enrollPaymentPlan === 'installments' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Monto 1ª cuota</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={enrollInst1Amount}
                      onChange={(e) => setEnrollInst1Amount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Fecha pago 1ª cuota</Label>
                    <Input
                      type="date"
                      value={enrollInst1Date}
                      onChange={(e) => setEnrollInst1Date(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Monto 2ª cuota</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={enrollInst2Amount}
                      onChange={(e) => setEnrollInst2Amount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Vencimiento 2ª cuota</Label>
                    <Input
                      type="date"
                      value={enrollInst2DueDate}
                      onChange={(e) => setEnrollInst2DueDate(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="mb-2 block">Notas (opcional)</Label>
              <Textarea
                value={enrollNotes}
                onChange={(e) => setEnrollNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEnrollDialog(false); resetEnrollForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending || !enrollStudentId}
            >
              {enrollMutation.isPending ? 'Inscribiendo...' : 'Inscribir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove Enrollment Dialog ──────────────────────────── */}
      <AlertDialog open={!!removeEnrollmentId} onOpenChange={(open) => !open && setRemoveEnrollmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar alumno del grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              El alumno pasará al estado "retirado" en este grupo. Esta acción puede deshacerse editando la inscripción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeEnrollmentId && removeEnrollmentMutation.mutate(removeEnrollmentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Session Attendance Dialog ─────────────────────────── */}
      <Dialog
        open={!!attendanceSession}
        onOpenChange={(open) => { if (!open) setAttendanceSession(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Asistencia — Sesión {attendanceSession?.session_number}
            </DialogTitle>
            <DialogDescription>
              {attendanceSession &&
                new Date(attendanceSession.scheduled_date + 'T12:00:00').toLocaleDateString('es-CO', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {activeEnrollments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No hay alumnos inscritos</p>
            ) : (
              activeEnrollments.map((enrollment: any) => {
                const isPresent = attendanceMap[enrollment.student_id] ?? true;
                return (
                  <div
                    key={enrollment.student_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="font-medium">{enrollment.students?.name}</span>
                    <div className="flex gap-2">
                      <Button
                        variant={isPresent ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAttendanceMap((prev) => ({ ...prev, [enrollment.student_id]: true }))}
                        className="gap-1"
                      >
                        <CheckCircle size={14} />
                        Presente
                      </Button>
                      <Button
                        variant={!isPresent ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAttendanceMap((prev) => ({ ...prev, [enrollment.student_id]: false }))}
                        className="gap-1"
                      >
                        <XCircle size={14} />
                        Ausente
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceSession(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveSessionAttendanceMutation.mutate()}
              disabled={saveSessionAttendanceMutation.isPending || activeEnrollments.length === 0}
            >
              {saveSessionAttendanceMutation.isPending ? 'Guardando...' : 'Guardar asistencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
