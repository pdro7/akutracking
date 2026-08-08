import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTeacherRecord } from '@/hooks/useUserRole';

type FilterKey = 'upcoming' | 'past' | 'all';

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' }> = {
  trial_scheduled: { label: 'Agendada', variant: 'warning' },
  trial_attended:  { label: 'Asistió',  variant: 'success' },
  trial_no_show:   { label: 'No asistió', variant: 'destructive' },
  trial_cancelled: { label: 'Cancelada', variant: 'outline' },
  interested:      { label: 'Interesado', variant: 'default' },
  enrolled:        { label: 'Inscrito',  variant: 'info' },
  new:             { label: 'Nuevo',     variant: 'secondary' },
  contacted:       { label: 'Contactado', variant: 'default' },
  lost:            { label: 'Perdido',   variant: 'destructive' },
};

export default function TeacherTrials() {
  const { data: teacher, isLoading: loadingTeacher } = useTeacherRecord();
  const [filter, setFilter] = useState<FilterKey>('upcoming');

  const { data: trials = [], isLoading } = useQuery({
    queryKey: ['teacher_trials', teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        // Do NOT fetch parent_name / phone / email — teachers must not see
        // parent PII. The child's name, timing and course are enough for
        // them to prepare and show up.
        .select(`
          id, child_name,
          trial_class_date, trial_class_time, status,
          notes, trial_objection,
          trial_course:virtual_courses!leads_trial_course_id_fkey(code, name)
        `)
        .eq('trial_teacher_id', teacher!.id)
        .not('trial_class_date', 'is', null)
        .order('trial_class_date')
        .order('trial_class_time');
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (filter === 'upcoming') return trials.filter((t: any) => (t.trial_class_date ?? '') >= today);
    if (filter === 'past')     return trials.filter((t: any) => (t.trial_class_date ?? '') < today);
    return trials;
  }, [trials, filter, today]);

  // Upcoming default: sort ascending (soonest first). Past: descending (most recent first).
  const ordered = useMemo(() => {
    const arr = [...filtered];
    if (filter === 'past') {
      arr.sort((a: any, b: any) => (b.trial_class_date ?? '').localeCompare(a.trial_class_date ?? ''));
    }
    return arr;
  }, [filtered, filter]);

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical size={22} />
            Mis clases de prueba
          </h1>
          <p className="text-sm text-muted-foreground">
            Trials que tienes asignadas.
          </p>
        </div>
        <div className="flex gap-2">
          {(['upcoming', 'past', 'all'] as FilterKey[]).map((k) => (
            <Button
              key={k}
              variant={filter === k ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(k)}
            >
              {k === 'upcoming' ? 'Próximas' : k === 'past' ? 'Pasadas' : 'Todas'}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Cargando trials…</Card>
      ) : ordered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {filter === 'upcoming'
            ? 'No tienes trials próximas asignadas.'
            : filter === 'past'
              ? 'No hay trials pasadas.'
              : 'No tienes trials asignadas todavía.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {ordered.map((t: any) => {
            const cfg = STATUS_LABEL[t.status] ?? { label: t.status, variant: 'secondary' as const };
            const dateStr = t.trial_class_date
              ? format(new Date(t.trial_class_date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
              : 'Sin fecha';
            const timeStr = t.trial_class_time ? t.trial_class_time.slice(0, 5) : '—';
            const course = t.trial_course;
            const isPast = (t.trial_class_date ?? '') < today;

            return (
              <Card key={t.id} className={`p-4 ${isPast ? 'opacity-80' : ''}`}>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <CalendarIcon size={16} className="text-primary" />
                      <span className="text-sm font-medium capitalize">{dateStr}</span>
                      <span className="text-sm font-mono text-muted-foreground">· {timeStr}</span>
                      <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    </div>

                    <div className="text-lg font-semibold">{t.child_name}</div>

                    {course && (
                      <div className="text-sm mt-1">
                        <span className="text-muted-foreground">Curso: </span>
                        <span className="font-mono">{course.code}</span> — {course.name}
                      </div>
                    )}

                    {t.notes && (
                      <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                        {t.notes}
                      </div>
                    )}

                    {t.trial_objection && (
                      <div className="text-xs mt-2 p-2 bg-muted/60 rounded">
                        <span className="font-semibold">Objeción registrada: </span>
                        {t.trial_objection}
                      </div>
                    )}
                  </div>

                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
