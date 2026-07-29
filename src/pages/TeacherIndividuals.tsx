import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import { formatWeeklyPattern, type WeeklySlot } from '@/lib/individualSchedule';
import { useTeacherRecord } from '@/hooks/useUserRole';

export default function TeacherIndividuals() {
  const navigate = useNavigate();
  const { data: teacher, isLoading: loadingTeacher } = useTeacherRecord();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['teacher_individuals', teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('individual_schedules')
        .select(`
          id, student_id, current_topic, weekly_pattern, is_active,
          student:students!individual_schedules_student_id_fkey(id, name, pack_size, classes_remaining, archived, parent_name, phone)
        `)
        .eq('teacher_id', teacher!.id)
        .eq('is_active', true);
      if (error) throw error;

      // Attach next scheduled session per student.
      const today = new Date().toISOString().slice(0, 10);
      const ids = (data ?? []).map((r: any) => r.student_id);
      const nextByStudent = new Map<string, { scheduled_date: string; scheduled_start_time: string }>();
      if (ids.length) {
        const { data: sess } = await supabase
          .from('individual_sessions')
          .select('student_id, scheduled_date, scheduled_start_time')
          .in('student_id', ids)
          .eq('status', 'scheduled')
          .gte('scheduled_date', today)
          .order('scheduled_date')
          .order('scheduled_start_time');
        for (const s of sess ?? []) {
          if (!nextByStudent.has((s as any).student_id)) {
            nextByStudent.set((s as any).student_id, {
              scheduled_date: (s as any).scheduled_date,
              scheduled_start_time: (s as any).scheduled_start_time,
            });
          }
        }
      }

      return (data ?? [])
        .filter((r: any) => r.student && !r.student.archived)
        .map((r: any) => ({
          ...r,
          weekly_pattern: Array.isArray(r.weekly_pattern) ? r.weekly_pattern as WeeklySlot[] : [],
          next_session: nextByStudent.get(r.student_id) ?? null,
        }));
    },
  });

  if (loadingTeacher) {
    return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  }
  if (!teacher) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Tu usuario no está vinculado a un registro de profesor. Contacta con un administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
        <User size={22} /> Mis alumnos individuales
        <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Alumnos que tomas 1-a-1. Click en una tarjeta para ver el detalle, marcar asistencia o registrar qué se hizo en la clase.
      </p>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Cargando…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No tienes alumnos individuales asignados por ahora.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r: any) => (
            <Card
              key={r.id}
              className="p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/individuales/${r.student_id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{r.student.name}</div>
                  {r.current_topic && (
                    <div className="text-xs text-muted-foreground truncate">Tema: {r.current_topic}</div>
                  )}
                  <div className="text-sm mt-1.5">{formatWeeklyPattern(r.weekly_pattern)}</div>
                  {r.next_session && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Próxima: {new Date(r.next_session.scheduled_date + 'T12:00:00').toLocaleDateString('es-CO')}
                      {' · '}{r.next_session.scheduled_start_time.slice(0, 5)}
                    </div>
                  )}
                  {r.student.parent_name && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Padre/madre: {r.student.parent_name}
                    </div>
                  )}
                </div>
                <Badge variant={r.student.classes_remaining > 0 ? 'success' : 'warning'} className="shrink-0">
                  {r.student.classes_remaining} / {r.student.pack_size}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
