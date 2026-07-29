import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { User, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  WEEKDAY_LABEL, WEEKDAYS, generateIndividualSessions, formatWeeklyPattern,
  type WeekDay, type WeeklySlot,
} from '@/lib/individualSchedule';

type Row = {
  id: string;
  student_id: string;
  teacher_id: string;
  current_topic: string | null;
  weekly_pattern: WeeklySlot[];
  is_active: boolean;
  student: { id: string; name: string; pack_size: number; classes_remaining: number } | null;
  teacher: { id: string; name: string } | null;
  next_session: { scheduled_date: string; scheduled_start_time: string } | null;
};

export default function IndividualStudents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Load individual schedules with joined student + teacher + next session.
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['individual_schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('individual_schedules')
        .select(`
          id, student_id, teacher_id, current_topic, weekly_pattern, is_active,
          student:students!individual_schedules_student_id_fkey(id, name, pack_size, classes_remaining, archived),
          teacher:teachers!individual_schedules_teacher_id_fkey(id, name)
        `)
        .eq('is_active', true);
      if (error) throw error;

      // Fetch upcoming sessions in one shot and attach the earliest per student.
      const today = new Date().toISOString().slice(0, 10);
      const studentIds = (data ?? []).map((r: any) => r.student_id);
      let nextByStudent = new Map<string, { scheduled_date: string; scheduled_start_time: string }>();
      if (studentIds.length) {
        const { data: sess } = await supabase
          .from('individual_sessions')
          .select('student_id, scheduled_date, scheduled_start_time')
          .in('student_id', studentIds)
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

      return (data ?? []).map((r: any): Row => ({
        id: r.id,
        student_id: r.student_id,
        teacher_id: r.teacher_id,
        current_topic: r.current_topic,
        weekly_pattern: Array.isArray(r.weekly_pattern) ? r.weekly_pattern : [],
        is_active: r.is_active,
        student: r.student && !r.student.archived ? r.student : null,
        teacher: r.teacher ?? null,
        next_session: nextByStudent.get(r.student_id) ?? null,
      })).filter((r) => r.student);
    },
  });

  const activeCount = rows.length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User size={22} />
            Alumnos individuales
            <span className="text-sm font-normal text-muted-foreground">({activeCount})</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Clases 1-a-1 con horario semanal fijo. Cada alumno tiene su propio profesor y patrón.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowNewDialog(true)}>
          <Plus size={16} />
          Nuevo alumno individual
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Cargando…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Todavía no hay alumnos configurados como individuales. Crea el primero con el botón arriba.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => (
            <Card
              key={r.id}
              className="p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/individuales/${r.student_id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{r.student?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Profesor: {r.teacher?.name ?? '—'}
                    {r.current_topic && ` · ${r.current_topic}`}
                  </div>
                  <div className="text-sm mt-1.5">{formatWeeklyPattern(r.weekly_pattern)}</div>
                  {r.next_session && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Próxima: {new Date(r.next_session.scheduled_date + 'T12:00:00').toLocaleDateString('es-CO')}
                      {' · '}{r.next_session.scheduled_start_time.slice(0, 5)}
                    </div>
                  )}
                </div>
                <Badge variant={r.student && r.student.classes_remaining > 0 ? 'success' : 'warning'} className="shrink-0">
                  {r.student?.classes_remaining ?? 0} / {r.student?.pack_size ?? 0}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewIndividualDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreated={() => {
          setShowNewDialog(false);
          queryClient.invalidateQueries({ queryKey: ['individual_schedules'] });
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// New individual dialog
// ────────────────────────────────────────────────────────────────

function NewIndividualDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [studentId, setStudentId] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [packSize, setPackSize] = useState<number>(8);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pattern, setPattern] = useState<WeeklySlot[]>([{ day: 'mon', start_time: '16:00', end_time: '17:00' }]);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  // Load students that could be picked as individual.
  // Individual modality preferred, but we let admin promote any student.
  const { data: students = [] } = useQuery({
    queryKey: ['students_pickable_individual'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, modality, archived')
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      // Exclude students who already have an individual_schedule.
      const { data: taken } = await supabase
        .from('individual_schedules')
        .select('student_id');
      const takenSet = new Set((taken ?? []).map((t: any) => t.student_id));
      return (data ?? []).filter((s: any) => !takenSet.has(s.id));
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers_active_for_individual'],
    enabled: open,
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

  const selectedStudent = students.find((s: any) => s.id === studentId) as any;

  const canSubmit = studentId && teacherId && pattern.length > 0 && packSize > 0 && startDate;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!canSubmit) throw new Error('Completa todos los campos');
      // 1. Ensure student's modality is 'individual' and pack_size matches.
      const { error: stErr } = await supabase
        .from('students')
        .update({
          modality: 'individual',
          pack_size: packSize,
          classes_remaining: packSize,
        })
        .eq('id', studentId);
      if (stErr) throw stErr;

      // 2. Insert schedule.
      const { error: schErr } = await supabase
        .from('individual_schedules')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          current_topic: topic.trim() || null,
          weekly_pattern: pattern as any,
        });
      if (schErr) throw schErr;

      // 3. Generate sessions covering the full pack.
      const generated = generateIndividualSessions(startDate, pattern, packSize);
      if (generated.length) {
        const rows = generated.map((g) => ({
          student_id: studentId,
          teacher_id: teacherId,
          scheduled_date: g.scheduled_date,
          scheduled_start_time: g.scheduled_start_time,
          scheduled_end_time: g.scheduled_end_time,
        }));
        const { error: sesErr } = await supabase.from('individual_sessions').insert(rows);
        if (sesErr) throw sesErr;
      }
    },
    onSuccess: () => {
      toast.success('Alumno individual creado');
      // Reset local state
      setStudentId(''); setTeacherId(''); setTopic(''); setPackSize(8);
      setStartDate(new Date().toISOString().slice(0, 10));
      setPattern([{ day: 'mon', start_time: '16:00', end_time: '17:00' }]);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo alumno individual</DialogTitle>
          <DialogDescription>
            Configura el horario semanal y el pack. Se generan {packSize} sesiones a partir de la fecha de inicio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Alumno *</label>
            <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedStudent?.name || 'Selecciona un alumno...'}
                  <ChevronsUpDown size={14} className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar alumno..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandGroup>
                      {(students as any[]).map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => { setStudentId(s.id); setStudentPickerOpen(false); }}
                        >
                          <Check size={14} className={cn('mr-2', s.id === studentId ? 'opacity-100' : 'opacity-0')} />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Profesor asignado *</label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="Selecciona profesor..." /></SelectTrigger>
              <SelectContent>
                {(teachers as any[]).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tema actual (opcional)</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej: Scratch avanzado, Python básico..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Pack *</label>
              <Select value={String(packSize)} onValueChange={(v) => setPackSize(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 clases</SelectItem>
                  <SelectItem value="8">8 clases</SelectItem>
                  <SelectItem value="10">10 clases</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Inicio *</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Patrón semanal *</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPattern([...pattern, { day: 'mon', start_time: '16:00', end_time: '17:00' }])}
              >
                <Plus size={12} /> Añadir día
              </Button>
            </div>
            <div className="space-y-2">
              {pattern.map((slot, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center">
                  <Select value={slot.day} onValueChange={(v) => {
                    const next = [...pattern]; next[i] = { ...slot, day: v as WeekDay }; setPattern(next);
                  }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d} value={d}>{WEEKDAY_LABEL[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="time" value={slot.start_time} onChange={(e) => {
                    const next = [...pattern]; next[i] = { ...slot, start_time: e.target.value }; setPattern(next);
                  }} />
                  <Input type="time" value={slot.end_time ?? ''} onChange={(e) => {
                    const next = [...pattern]; next[i] = { ...slot, end_time: e.target.value || null }; setPattern(next);
                  }} placeholder="Fin (opcional)" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPattern(pattern.filter((_, j) => j !== i))}
                    disabled={pattern.length === 1}
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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
