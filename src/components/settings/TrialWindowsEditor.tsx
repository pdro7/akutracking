import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FlaskConical, Plus, Pencil, Trash2, Lightbulb, CalendarOff, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  WEEKDAYS, WEEKDAY_LABEL, hhmm, suggestWindowsFromTeachers, isAlreadyConfigured,
  slotsIn, slotStarts,
  type TrialWindow, type WindowSuggestion,
} from '@/lib/trialWindows';

// Sección de Settings para configurar cuándo se pueden agendar clases de
// prueba. Sustituye a la configuración que vivía en Calendly.
export function TrialWindowsEditor() {
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<TrialWindow | null>(null);
  const [weekday, setWeekday] = useState('6');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:45');
  const [capacity, setCapacity] = useState('1');
  const [duration, setDuration] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sourceSlotId, setSourceSlotId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [paramDuration, setParamDuration] = useState('60');
  const [paramLeadHours, setParamLeadHours] = useState('24');
  const [paramHorizon, setParamHorizon] = useState('21');

  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [excDate, setExcDate] = useState('');
  const [excReason, setExcReason] = useState('');
  const [deleteExcId, setDeleteExcId] = useState<string | null>(null);

  const { data: windows = [] } = useQuery({
    queryKey: ['trial_windows'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trial_windows')
        .select('*')
        .order('weekday')
        .order('start_time');
      if (error) throw error;
      return (data ?? []) as TrialWindow[];
    },
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['trial_window_exceptions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trial_window_exceptions')
        .select('*')
        .gte('exception_date', new Date().toISOString().slice(0, 10))
        .order('exception_date');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Parámetros globales del agendador. La duración la puede sobreescribir
  // cada ventana; la antelación y el horizonte son globales.
  const { data: params } = useQuery({
    queryKey: ['trial_params'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('settings')
        .select('id, trial_duration_minutes, trial_min_lead_hours, trial_horizon_days')
        .limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const defaultDuration: number = params?.trial_duration_minutes ?? 60;

  useEffect(() => {
    if (!params) return;
    setParamDuration(String(params.trial_duration_minutes ?? 60));
    setParamLeadHours(String(params.trial_min_lead_hours ?? 24));
    setParamHorizon(String(params.trial_horizon_days ?? 21));
  }, [params]);

  const saveParamsMutation = useMutation({
    mutationFn: async () => {
      if (!params?.id) throw new Error('No hay fila de settings');
      const lead = Number(paramLeadHours);
      const horizon = Number(paramHorizon);
      const dur = Number(paramDuration);
      if (!(dur > 0)) throw new Error('La duración debe ser mayor que cero');
      if (lead < 0) throw new Error('La antelación no puede ser negativa');
      if (!(horizon > 0)) throw new Error('El horizonte debe ser al menos 1 día');
      // Con una antelación mayor que el horizonte no quedaría ningún hueco
      // que ofrecer: el filtro de antelación se comería toda la ventana.
      if (lead >= horizon * 24) {
        throw new Error('La antelación no puede superar al horizonte');
      }
      const { error } = await (supabase as any).from('settings').update({
        trial_duration_minutes: dur,
        trial_min_lead_hours: lead,
        trial_horizon_days: horizon,
      }).eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_params'] });
      queryClient.invalidateQueries({ queryKey: ['trial_availability'] });
      toast.success('Parámetros actualizados');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers_for_trial_suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('name, is_active, availability');
      if (error) throw error;
      return data ?? [];
    },
  });

  const suggestions = suggestWindowsFromTeachers(teachers as any[]);
  const pending = suggestions.filter((s) => !isAlreadyConfigured(s, windows));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
        capacity: Number(capacity) || 1,
        slot_duration_minutes: duration ? Number(duration) : null,
        is_active: isActive,
        source_slot_id: sourceSlotId,
      };
      if (endTime <= startTime) throw new Error('La hora de fin debe ser posterior a la de inicio');
      const dur = duration ? Number(duration) : defaultDuration;
      if (dur <= 0) throw new Error('La duración debe ser mayor que cero');
      if (slotsIn(startTime, endTime, dur) < 1) {
        throw new Error(`La ventana es más corta que una clase de ${dur} min`);
      }
      const q = editing
        ? (supabase as any).from('trial_windows').update(payload).eq('id', editing.id)
        : (supabase as any).from('trial_windows').insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_windows'] });
      setShowDialog(false);
      toast.success(editing ? 'Ventana actualizada' : 'Ventana creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSuggestionMutation = useMutation({
    mutationFn: async (s: WindowSuggestion) => {
      const { error } = await (supabase as any).from('trial_windows').insert({
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: 1,
        is_active: true,
        source_slot_id: s.source_slot_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_windows'] });
      toast.success('Ventana añadida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('trial_windows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_windows'] });
      setDeleteId(null);
      toast.success('Ventana eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveExceptionMutation = useMutation({
    mutationFn: async () => {
      if (!excDate) throw new Error('La fecha es obligatoria');
      const { error } = await (supabase as any).from('trial_window_exceptions').insert({
        exception_date: excDate,
        kind: 'block',
        reason: excReason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_window_exceptions'] });
      setShowExceptionDialog(false);
      setExcDate(''); setExcReason('');
      toast.success('Día bloqueado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('trial_window_exceptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial_window_exceptions'] });
      setDeleteExcId(null);
      toast.success('Bloqueo eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewStarts = slotStarts(
    startTime, endTime, duration ? Number(duration) : defaultDuration,
  );

  const openNew = () => {
    setEditing(null);
    setWeekday('6'); setStartTime('09:00'); setEndTime('11:00');
    setCapacity('1'); setDuration(''); setIsActive(true); setSourceSlotId(null);
    setShowDialog(true);
  };

  const openEdit = (w: TrialWindow) => {
    setEditing(w);
    setWeekday(String(w.weekday));
    setStartTime(hhmm(w.start_time));
    setEndTime(hhmm(w.end_time));
    setCapacity(String(w.capacity));
    setDuration(w.slot_duration_minutes ? String(w.slot_duration_minutes) : '');
    setIsActive(w.is_active);
    setSourceSlotId(w.source_slot_id);
    setShowDialog(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
            <FlaskConical className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Clases de prueba</h2>
            <p className="text-sm text-muted-foreground">
              Días y horas en los que los padres pueden agendar desde el link público
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowExceptionDialog(true)}>
            <CalendarOff size={16} />
            Bloquear día
          </Button>
          <Button size="sm" className="gap-2" onClick={openNew}>
            <Plus size={16} />
            Añadir ventana
          </Button>
        </div>
      </div>

      {/* Parámetros globales del agendador */}
      <div className="mb-6 rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Reglas de agendamiento</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Duración de cada clase</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={5} step={5}
                value={paramDuration}
                onChange={(e) => setParamDuration(e.target.value)}
              />
              <span className="text-xs text-muted-foreground shrink-0">min</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor por defecto; cada ventana puede cambiarlo.
            </p>
          </div>
          <div>
            <Label className="text-xs">Antelación mínima</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0}
                value={paramLeadHours}
                onChange={(e) => setParamLeadHours(e.target.value)}
              />
              <span className="text-xs text-muted-foreground shrink-0">horas</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No se puede reservar con menos margen que este.
            </p>
          </div>
          <div>
            <Label className="text-xs">Horizonte visible</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={1}
                value={paramHorizon}
                onChange={(e) => setParamHorizon(e.target.value)}
              />
              <span className="text-xs text-muted-foreground shrink-0">días</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hasta dónde puede mirar el padre hacia adelante.
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={saveParamsMutation.isPending}
            onClick={() => saveParamsMutation.mutate()}
          >
            Guardar reglas
          </Button>
        </div>
      </div>

      {/* Sugerencias desde la disponibilidad de los profesores */}
      {pending.length > 0 && (
        <div className="mb-6 rounded-lg border border-dashed p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-warning" />
            <span className="text-sm font-medium">Sugerencias según la disponibilidad de tus profesores</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.map((s) => (
              <Button
                key={s.source_slot_id}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-auto py-1.5"
                disabled={addSuggestionMutation.isPending}
                onClick={() => addSuggestionMutation.mutate(s)}
                title={`Disponibles: ${s.teachers.join(', ')}`}
              >
                <Plus size={13} />
                {WEEKDAY_LABEL[s.weekday]} {s.start_time}–{s.end_time}
                <span className="text-muted-foreground">
                  ({s.teachers.length} {s.teachers.length === 1 ? 'profe' : 'profes'})
                </span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Son sólo propuestas. Puedes añadirlas y luego ajustar la hora o la duración.
          </p>
        </div>
      )}

      {windows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No hay ventanas configuradas, así que el link público no ofrece ningún horario.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Ventana</TableHead>
              <TableHead>Clases que genera</TableHead>
              <TableHead>Por clase</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {windows.map((w) => {
              const dur = w.slot_duration_minutes ?? defaultDuration;
              const starts = slotStarts(hhmm(w.start_time), hhmm(w.end_time), dur);
              return (
              <TableRow key={w.id} className={!w.is_active ? 'opacity-50' : ''}>
                <TableCell>{WEEKDAY_LABEL[w.weekday]}</TableCell>
                <TableCell className="font-mono text-sm">
                  {hhmm(w.start_time)} – {hhmm(w.end_time)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {starts.map((t) => (
                      <span key={t} className="text-xs font-mono border rounded px-1.5 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{dur} min c/u</span>
                </TableCell>
                <TableCell>
                  {w.capacity === 1
                    ? <span className="text-sm">Individual</span>
                    : <span className="text-sm">{w.capacity} estudiantes</span>}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    w.is_active
                      ? 'bg-green-50 text-green-700 border-green-300'
                      : 'bg-muted text-muted-foreground border-muted'
                  }`}>
                    {w.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 items-center justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(w.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Días bloqueados */}
      {exceptions.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <p className="text-sm font-medium mb-3">Días bloqueados</p>
          <div className="flex flex-wrap gap-2">
            {exceptions.map((e: any) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-2 text-xs border rounded-full pl-3 pr-1 py-1"
              >
                {new Date(e.exception_date + 'T12:00:00').toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'long',
                })}
                {e.reason && <span className="text-muted-foreground">· {e.reason}</span>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => setDeleteExcId(e.id)}
                >
                  <Trash2 size={11} className="text-destructive" />
                </Button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diálogo de ventana */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar ventana' : 'Nueva ventana'}</DialogTitle>
            <DialogDescription>
              Se repite todas las semanas. El sistema sólo ofrecerá el horario si además
              hay algún profesor libre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Día de la semana</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{WEEKDAY_LABEL[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hora de inicio</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label>Hora de fin</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duración de cada clase</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder={`${defaultDuration} min`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Vacío = {defaultDuration} min
                </p>
              </div>
              <div>
                <Label>Estudiantes por clase</Label>
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  1 = individual
                </p>
              </div>
            </div>

            {/* Previsualización: la ventana es un rango que se parte en
                clases consecutivas, así que conviene ver qué horas saldrán. */}
            {previewStarts.length > 0 ? (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1.5">
                  El padre verá {previewStarts.length}{' '}
                  {previewStarts.length === 1 ? 'hora' : 'horas'}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previewStarts.map((t) => (
                    <span key={t} className="text-xs font-mono border rounded px-1.5 py-0.5 bg-background">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive">
                La ventana es más corta que una clase: no generará ningún horario.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="trial-window-active"
                checked={isActive}
                onCheckedChange={(v) => setIsActive(v === true)}
              />
              <Label htmlFor="trial-window-active" className="cursor-pointer">Activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de bloqueo de día */}
      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear un día</DialogTitle>
            <DialogDescription>
              No se ofrecerá ningún horario ese día, aunque haya ventanas configuradas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={excDate} onChange={(e) => setExcDate(e.target.value)} />
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={excReason}
                onChange={(e) => setExcReason(e.target.value)}
                placeholder="Vacaciones, festivo interno…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExceptionDialog(false)}>Cancelar</Button>
            <Button
              disabled={saveExceptionMutation.isPending}
              onClick={() => saveExceptionMutation.mutate()}
            >
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta ventana?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de ofrecerse en el link público. Las reservas ya hechas en ese
              horario no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteExcId} onOpenChange={(o) => !o && setDeleteExcId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar el bloqueo?</AlertDialogTitle>
            <AlertDialogDescription>
              Ese día volverá a ofrecer los horarios de sus ventanas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExcId && deleteExceptionMutation.mutate(deleteExcId)}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
