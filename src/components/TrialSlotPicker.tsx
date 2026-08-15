import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { hhmm } from '@/lib/trialWindows';

// Selector de hueco para clases de prueba.
//
// Por defecto ofrece sólo huecos reales: los que salen de las ventanas
// configuradas en Settings menos la ocupación de los profesores. El modo
// "forzar" existe para el admin, que a veces necesita colocar una prueba
// a una hora arbitraria; el backend sigue impidiendo pisar a un profesor
// que ya esté ocupado a esa hora.

export type TrialSlotValue = {
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  force: boolean;
};

type Slot = {
  slot_date: string;
  start_time: string;
  end_time: string;
  seats_left: number;
};

type Props = {
  value: TrialSlotValue;
  onChange: (v: TrialSlotValue) => void;
  allowForce?: boolean;
};

// Selector compacto para el CRM. La página pública tiene el suyo propio,
// con calendario mensual: allí no hay sesión y los huecos se piden a la
// edge function, porque anon no puede ejecutar la RPC.
export function TrialSlotPicker({ value, onChange, allowForce = true }: Props) {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['trial_availability'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_trial_availability', {});
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
    // Los huecos caducan rápido: otro padre puede reservar mientras miras.
    staleTime: 30_000,
  });

  const byDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const arr = byDate.get(s.slot_date) ?? [];
    arr.push(s);
    byDate.set(s.slot_date, arr);
  }
  const dates = Array.from(byDate.keys()).sort();

  const label = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

  if (value.force) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              value={value.date}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
            />
          </div>
          <div>
            <Label>Hora</Label>
            <Input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
            />
          </div>
        </div>
        {allowForce && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked
              onCheckedChange={() => onChange({ date: '', time: '', force: false })}
            />
            Forzar un horario fuera de las ventanas configuradas
          </label>
        )}
        <p className="text-xs text-muted-foreground">
          Se guardará aunque no haya ventana configurada. Si el profesor asignado ya
          tuviera otra prueba a esa hora, el sistema seguirá rechazándolo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando horarios...</p>
      ) : dates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay horarios disponibles. Revisa las ventanas en Ajustes → Clases de prueba,
          o fuerza un horario.
        </p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {dates.map((d) => (
            <div key={d}>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 capitalize">
                {label(d)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {byDate.get(d)!.map((s) => {
                  const t = hhmm(s.start_time);
                  const selected = value.date === d && value.time === t;
                  return (
                    <Button
                      key={`${d}-${t}`}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => onChange({ date: d, time: t, force: false })}
                    >
                      {t}–{hhmm(s.end_time)}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {allowForce && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={false}
            onCheckedChange={() => onChange({ ...value, force: true })}
          />
          Forzar un horario fuera de las ventanas configuradas
        </label>
      )}
    </div>
  );
}
