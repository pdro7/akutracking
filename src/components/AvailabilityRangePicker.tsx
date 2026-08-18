import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import {
  AVAILABILITY_DAYS,
  DAY_LABEL,
  normalizeRanges,
  toMinutes,
  type AvailabilityRange,
} from '@/lib/availability';
import type { SlotDay } from '@/lib/timeSlots';

type Props = {
  value: AvailabilityRange[];
  onChange: (ranges: AvailabilityRange[]) => void;
  label?: string;
};

/** Franja por defecto al añadir una nueva, si el día está vacío. */
const DEFAULT_RANGE = { from: '09:00', to: '12:00' };

export function AvailabilityRangePicker({ value, onChange, label }: Props) {
  const rangesOf = (day: SlotDay) =>
    value
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.day === day)
      .sort((a, b) => toMinutes(a.r.from) - toMinutes(b.r.from));

  const update = (index: number, patch: Partial<AvailabilityRange>) => {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const add = (day: SlotDay) => {
    const existing = rangesOf(day);
    // Se encadena tras la última franja del día para no crear un solape
    // que la normalización fusionaría de inmediato.
    const last = existing[existing.length - 1]?.r;
    const next = last
      ? { from: last.to, to: `${String(Math.min(Number(last.to.slice(0, 2)) + 2, 22)).padStart(2, '0')}:${last.to.slice(3)}` }
      : DEFAULT_RANGE;
    onChange([...value, { day, ...next }]);
  };

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}
      <p className="text-xs text-muted-foreground">
        Marca las horas en las que puedes dar clase. El sistema deduce solo qué
        cursos y qué clases de prueba caben dentro.
      </p>

      <div className="space-y-2">
        {AVAILABILITY_DAYS.map((day) => {
          const rows = rangesOf(day);
          return (
            <div key={day} className="flex flex-wrap items-center gap-2 border-t pt-2">
              <div className="w-24 shrink-0 text-sm font-medium">{DAY_LABEL[day]}</div>

              {rows.length === 0 && (
                <span className="text-sm text-muted-foreground flex-1">No disponible</span>
              )}

              <div className="flex flex-wrap items-center gap-2 flex-1">
                {rows.map(({ r, i }) => {
                  const invalid = toMinutes(r.from) >= toMinutes(r.to);
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 ${invalid ? 'border-destructive' : ''}`}
                    >
                      <Input
                        type="time"
                        step={900}
                        value={r.from}
                        onChange={(e) => update(i, { from: e.target.value })}
                        onBlur={() => onChange(normalizeRanges(value))}
                        className="h-7 w-[7.5rem] border-0 p-0 text-sm shadow-none focus-visible:ring-0"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        step={900}
                        value={r.to}
                        onChange={(e) => update(i, { to: e.target.value })}
                        onBlur={() => onChange(normalizeRanges(value))}
                        className="h-7 w-[7.5rem] border-0 p-0 text-sm shadow-none focus-visible:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Quitar franja"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => add(day)}>
                <Plus size={14} />
                Añadir
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
