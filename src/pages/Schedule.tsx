import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarClock, GraduationCap, FlaskConical } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useUserRole, useTeacherRecord } from '@/hooks/useUserRole';

type CalendarItem = {
  kind: 'session' | 'trial';
  id: string;
  date: string;      // YYYY-MM-DD
  time: string | null;
  endTime: string | null;
  code: string;
  courseName: string;
  teacherName: string | null;
  teacherId: string | null;
  href: string | null;
  extra?: string;    // child name for trials
};

function timeKey(t: string | null): number {
  if (!t) return 9999;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function Schedule() {
  const navigate = useNavigate();
  const { data: role } = useUserRole();
  const { data: teacherRecord } = useTeacherRecord();
  const isTeacher = role === 'teacher';

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [dayDetail, setDayDetail] = useState<Date | null>(null);

  const rangeStart = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), [cursor]);
  const rangeEnd = useMemo(() => endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), [cursor]);

  const rangeStartStr = format(rangeStart, 'yyyy-MM-dd');
  const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !isTeacher,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings_holidays'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('holidays').maybeSingle();
      return data;
    },
  });
  const holidays: Set<string> = useMemo(
    () => new Set(((settings as any)?.holidays as string[]) || []),
    [settings],
  );

  const { data: sessions = [] } = useQuery({
    queryKey: ['schedule_sessions', rangeStartStr, rangeEndStr, isTeacher, teacherRecord?.id, teacherFilter],
    queryFn: async () => {
      let query = supabase
        .from('course_sessions')
        .select('id, scheduled_date, group_id, course_groups!inner(id, code, start_time, end_time, teacher_id, virtual_courses(name), teachers(id, name))')
        .gte('scheduled_date', rangeStartStr)
        .lte('scheduled_date', rangeEndStr)
        .order('scheduled_date');

      if (isTeacher && teacherRecord?.id) {
        query = query.eq('course_groups.teacher_id', teacherRecord.id);
      } else if (teacherFilter !== 'all') {
        query = query.eq('course_groups.teacher_id', teacherFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((s: any): CalendarItem => ({
        kind: 'session',
        id: s.id,
        date: s.scheduled_date,
        time: s.course_groups?.start_time?.slice(0, 5) ?? null,
        endTime: s.course_groups?.end_time?.slice(0, 5) ?? null,
        code: s.course_groups?.code ?? '—',
        courseName: s.course_groups?.virtual_courses?.name ?? '',
        teacherName: s.course_groups?.teachers?.name ?? null,
        teacherId: s.course_groups?.teacher_id ?? null,
        href: s.course_groups?.id ? `/virtual-groups/${s.course_groups.id}` : null,
      }));
    },
  });

  const { data: trials = [] } = useQuery({
    queryKey: ['schedule_trials', rangeStartStr, rangeEndStr, isTeacher, teacherRecord?.id, teacherFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, child_name, trial_class_date, trial_class_time, trial_teacher_id, trial_course_id, teachers:trial_teacher_id(id, name), virtual_courses:trial_course_id(name, code)')
        .not('trial_class_date', 'is', null)
        .gte('trial_class_date', rangeStartStr)
        .lte('trial_class_date', rangeEndStr)
        .order('trial_class_date');

      if (isTeacher && teacherRecord?.id) {
        query = query.eq('trial_teacher_id', teacherRecord.id);
      } else if (teacherFilter !== 'all') {
        query = query.eq('trial_teacher_id', teacherFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((l: any): CalendarItem => ({
        kind: 'trial',
        id: l.id,
        date: l.trial_class_date,
        time: l.trial_class_time?.slice(0, 5) ?? null,
        endTime: null,
        code: l.virtual_courses?.code ?? 'Trial',
        courseName: l.virtual_courses?.name ?? 'Clase de prueba',
        teacherName: l.teachers?.name ?? null,
        teacherId: l.trial_teacher_id ?? null,
        href: `/leads/${l.id}`,
        extra: l.child_name,
      }));
    },
  });

  const days = useMemo(() => eachDayOfInterval({ start: rangeStart, end: rangeEnd }), [rangeStart, rangeEnd]);

  const itemsByDate = useMemo(() => {
    const bag: Record<string, CalendarItem[]> = {};
    for (const it of [...sessions, ...trials]) {
      (bag[it.date] ||= []).push(it);
    }
    for (const key of Object.keys(bag)) {
      bag[key].sort((a, b) => timeKey(a.time) - timeKey(b.time));
    }
    return bag;
  }, [sessions, trials]);

  const detailDateStr = dayDetail ? format(dayDetail, 'yyyy-MM-dd') : '';
  const detailItems = detailDateStr ? (itemsByDate[detailDateStr] || []) : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock size={22} />
            {isTeacher ? 'Mi calendario' : 'Calendario de clases'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTeacher
              ? 'Sesiones y clases de prueba asignadas a ti.'
              : 'Sesiones de grupos y clases de prueba, con feriados marcados.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isTeacher && (
            <Select value={teacherFilter} onValueChange={setTeacherFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los profes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profes</SelectItem>
                {(teachers as any[]).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[140px] text-center text-sm font-medium capitalize">
            {format(cursor, 'MMMM yyyy', { locale: es })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          Sesión de grupo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
          Clase de prueba
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'hsl(0 80% 90%)' }} />
          Feriado
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="p-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const items = itemsByDate[dayStr] || [];
            const inMonth = isSameMonth(day, cursor);
            const isHoliday = holidays.has(dayStr);
            const highlightToday = isToday(day);

            return (
              <button
                type="button"
                key={dayStr}
                onClick={() => setDayDetail(day)}
                className={[
                  'min-h-[110px] border-b border-r p-1.5 text-left align-top transition-colors',
                  'hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 relative',
                  !inMonth ? 'bg-muted/20 text-muted-foreground/60' : '',
                ].join(' ')}
                style={isHoliday ? { background: 'hsl(0 80% 95%)' } : undefined}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={[
                      'text-xs font-semibold px-1.5 py-0.5 rounded',
                      highlightToday ? 'bg-primary text-primary-foreground' : '',
                    ].join(' ')}
                  >
                    {format(day, 'd')}
                  </span>
                  {isHoliday && <span className="text-[10px] text-red-700/70 font-medium">Feriado</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((it) => (
                    <div
                      key={`${it.kind}-${it.id}`}
                      className={[
                        'text-[11px] px-1 py-0.5 rounded truncate flex items-center gap-1',
                        it.kind === 'session' ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-900',
                      ].join(' ')}
                      title={`${it.time ?? ''} ${it.code} — ${it.courseName}${it.extra ? ' (' + it.extra + ')' : ''}`}
                    >
                      <span className="font-mono">{it.time ?? '—'}</span>
                      <span className="truncate">{it.code}</span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">+{items.length - 3} más</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!dayDetail} onOpenChange={(open) => !open && setDayDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dayDetail && format(dayDetail, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </DialogTitle>
            {dayDetail && holidays.has(format(dayDetail, 'yyyy-MM-dd')) && (
              <DialogDescription className="text-red-700">Este día es feriado según la configuración.</DialogDescription>
            )}
          </DialogHeader>

          {detailItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin clases este día.</p>
          ) : (
            <div className="space-y-3 py-2">
              {detailItems.map((it) => (
                <div
                  key={`${it.kind}-${it.id}`}
                  className="border rounded-md p-3 hover:bg-muted/40 cursor-pointer"
                  onClick={() => {
                    if (it.href) {
                      setDayDetail(null);
                      navigate(it.href);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {it.kind === 'session'
                        ? <GraduationCap size={16} className="text-primary" />
                        : <FlaskConical size={16} className="text-orange-600" />}
                      <span className="font-mono font-semibold">{it.code}</span>
                      <Badge variant={it.kind === 'session' ? 'default' : 'warning'} className="text-[10px]">
                        {it.kind === 'session' ? 'Grupo' : 'Prueba'}
                      </Badge>
                    </div>
                    <span className="text-sm font-mono">
                      {it.time ?? '—'}{it.endTime ? `–${it.endTime.slice(0, 5)}` : ''}
                    </span>
                  </div>
                  <p className="text-sm">{it.courseName}</p>
                  {it.extra && <p className="text-xs text-muted-foreground">Alumno: {it.extra}</p>}
                  {it.teacherName && <p className="text-xs text-muted-foreground">Profesor: {it.teacherName}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
