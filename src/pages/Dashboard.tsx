import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, TrendingUp, Monitor, Video } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const markRequestedMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ payment_requested_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_installments'] });
      toast.success('Marcado como solicitado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  const { data: activeGroups = [] } = useQuery({
    queryKey: ['active_groups_count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_groups')
        .select('id')
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    }
  });

  // Virtual enrollments with any pending payment (1st or 2nd installment)
  const { data: pendingInstallments = [] } = useQuery({
    queryKey: ['pending_installments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('id, payment_plan, installment_1_paid_at, installment_1_amount, installment_2_due_date, installment_2_amount, payment_requested_at, students(id, name), course_groups(code, virtual_courses(name))')
        .eq('status', 'active')
        .or('installment_1_paid_at.is.null,and(payment_plan.eq.installments,installment_2_paid_at.is.null,installment_2_due_date.not.is.null)');
      if (error) throw error;
      return data || [];
    }
  });

  // Students with 0 classes remaining (pack exhausted)
  const packDue = students.filter(s => s.classes_remaining === 0);

  // Today's sessions
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySessions = [] } = useQuery({
    queryKey: ['today_sessions', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_sessions')
        .select('id, session_number, group_id, course_groups(id, code, status, virtual_courses(name), teachers(name))')
        .eq('scheduled_date', today)
        .order('session_number');
      if (error) throw error;
      // Only show groups that are active or forming (not completed/cancelled)
      return (data || []).filter((s: any) =>
        s.course_groups && !['completed', 'cancelled'].includes(s.course_groups.status)
      );
    },
  });

  // Last 7 enrolled students
  const { data: recentStudents = [] } = useQuery({
    queryKey: ['recent_students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, parent_name, enrollment_date, modality, classes_remaining')
        .eq('is_active', true)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(7);
      if (error) throw error;
      return data || [];
    }
  });

  const activeStudents = students;
  const lowCredits = activeStudents.filter(s => s.classes_remaining > 0 && s.classes_remaining <= 2);
  const totalPaymentAlerts = packDue.length + (pendingInstallments as any[]).length;

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  const stats = [
    { label: 'Alumnos activos', value: activeStudents.length, icon: Users },
    { label: 'Alertas de pago', value: totalPaymentAlerts, icon: TrendingUp },
    { label: 'Créditos bajos', value: lowCredits.length, icon: Calendar },
    { label: 'Grupos activos', value: activeGroups.length, icon: Monitor },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your academy overview.</p>
        </div>
        <Button onClick={() => navigate('/students/new')} className="gap-2">
          <Plus size={20} />
          Add Student
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center text-white">
                <stat.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Clases de hoy ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Video size={20} className="text-primary" />
          Clases de hoy — {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        <Card>
          {(todaySessions as any[]).length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No hay clases programadas para hoy
            </div>
          ) : (
            <div className="divide-y">
              {(todaySessions as any[]).map((session: any) => {
                const group = session.course_groups;
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate(`/virtual-groups/${group?.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {session.session_number}
                      </div>
                      <div>
                        <p className="font-medium">{group?.virtual_courses?.name}</p>
                        <p className="text-xs text-muted-foreground">{group?.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {group?.teachers?.name && (
                        <p className="text-sm text-muted-foreground">{group.teachers.name}</p>
                      )}
                      <Badge variant="success" className="text-xs">Sesión {session.session_number}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Pendientes de pago ── */}
        <div>
          <h2 className="text-xl font-bold mb-3">Pendientes de pago</h2>
          <Card>
            {totalPaymentAlerts === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Sin alertas de pago pendientes
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packDue.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/student/${student.id}`)}
                    >
                      <TableCell className="font-medium text-primary">{student.name}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">Pack agotado</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">0 clases restantes</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {(pendingInstallments as any[]).map((e: any) => {
                    const today = new Date().toISOString().split('T')[0];
                    const firstPending = !e.installment_1_paid_at;
                    const secondPending = e.payment_plan === 'installments' && !e.installment_2_due_date?.includes('null') && e.installment_2_due_date;
                    const isOverdue = secondPending && e.installment_2_due_date < today;
                    const dueDate = e.installment_2_due_date
                      ? new Date(e.installment_2_due_date + 'T12:00:00').toLocaleDateString('es-CO')
                      : null;
                    const fmt = (n: number) => n.toLocaleString('es-CO');
                    const label = firstPending
                      ? (e.payment_plan === 'full' ? 'Pago pendiente' : '1ª cuota pendiente')
                      : (isOverdue ? '2ª cuota vencida' : '2ª cuota pendiente');
                    const badgeVariant = (firstPending || isOverdue) ? 'destructive' : 'warning';
                    return (
                      <TableRow
                        key={`${e.id}-${firstPending ? '1' : '2'}`}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/student/${(e.students as any)?.id}`)}
                      >
                        <TableCell className="font-medium text-primary">{(e.students as any)?.name}</TableCell>
                        <TableCell>
                          <Badge variant={badgeVariant} className="whitespace-nowrap">{label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {firstPending
                            ? `${e.payment_plan === 'full' ? 'Pago completo' : '1ª cuota'}${e.installment_1_amount ? ` · $${fmt(e.installment_1_amount)}` : ''}`
                            : `Vence ${dueDate}${e.installment_2_amount ? ` · $${fmt(e.installment_2_amount)}` : ''}`}
                        </TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          {e.payment_requested_at ? (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 whitespace-nowrap">
                              ✓ Solicitado
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 px-2 text-muted-foreground hover:text-blue-600"
                              disabled={markRequestedMutation.isPending}
                              onClick={() => markRequestedMutation.mutate(e.id)}
                            >
                              Marcar solicitado
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        {/* ── Últimas inscripciones ── */}
        <div>
          <h2 className="text-xl font-bold mb-3">Últimas inscripciones</h2>
          <Card>
            {(recentStudents as any[]).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No hay alumnos registrados aún
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Inscripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentStudents as any[]).map((student: any) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/student/${student.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-primary">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.parent_name}</div>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{student.modality ?? 'presencial'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {student.enrollment_date
                          ? new Date(student.enrollment_date + 'T12:00:00').toLocaleDateString('es-CO')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
