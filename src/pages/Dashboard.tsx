import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, TrendingUp, Monitor } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

export default function Dashboard() {
  const navigate = useNavigate();
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

  // Virtual enrollments with unpaid 2nd installment
  const { data: pendingInstallments = [] } = useQuery({
    queryKey: ['pending_installments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('id, installment_2_due_date, installment_2_amount, students(id, name), course_groups(code, virtual_courses(name))')
        .eq('payment_plan', 'installments')
        .is('installment_2_paid_at', null)
        .not('installment_2_due_date', 'is', null);
      if (error) throw error;
      return data || [];
    }
  });

  // Students with 0 classes remaining (pack exhausted)
  const packDue = students.filter(s => s.classes_remaining === 0);

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
                    </TableRow>
                  ))}
                  {(pendingInstallments as any[]).map((e: any) => {
                    const dueDate = e.installment_2_due_date
                      ? new Date(e.installment_2_due_date + 'T12:00:00').toLocaleDateString('es-CO')
                      : '—';
                    const isOverdue = e.installment_2_due_date && e.installment_2_due_date < new Date().toISOString().split('T')[0];
                    return (
                      <TableRow
                        key={e.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/student/${(e.students as any)?.id}`)}
                      >
                        <TableCell className="font-medium text-primary">{(e.students as any)?.name}</TableCell>
                        <TableCell>
                          <Badge variant={isOverdue ? 'destructive' : 'warning'}>
                            {isOverdue ? '2ª cuota vencida' : '2ª cuota pendiente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          Vence {dueDate}
                          {e.installment_2_amount ? ` · $${e.installment_2_amount}` : ''}
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
