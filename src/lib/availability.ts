// Disponibilidad declarada por los profesores, como rangos por día.
//
// Antes se guardaba como una lista de IDs del catálogo de timeSlots.ts:
// bloques fijos de 90 minutos. El problema es que ese catálogo son las
// unidades de UN consumidor —los cursos, que duran hora y media— mientras
// que las clases de prueba duran 60 minutos y las individuales también. Un
// profesor libre a las 11:00 un miércoles no tenía forma de decirlo.
//
// Un rango ("los miércoles de 09:00 a 13:00") es lo que el profesor sabe de
// verdad, y de ahí se derivan ambas cosas: qué bloques de curso caben
// dentro y qué huecos de prueba. El catálogo de timeSlots.ts sigue en uso
// para leads.preferred_slots, donde una lista corta de opciones gruesas es
// mejor UX para un padre que un selector de horas libres.

import { TIME_SLOTS, type SlotDay } from './timeSlots';

export type AvailabilityRange = {
  day: SlotDay;
  /** "HH:MM" */
  from: string;
  to: string;
};

export const AVAILABILITY_DAYS: SlotDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DAY_LABEL: Record<SlotDay, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
};

export const DAY_SHORT: Record<SlotDay, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb',
};

/** "HH:MM:SS" o "HH:MM" → minutos desde medianoche. */
export function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(m: number): string {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function rangeLabel(r: AvailabilityRange): string {
  return `${DAY_SHORT[r.day]} ${r.from}–${r.to}`;
}

/**
 * Lee el campo `availability` venga en el formato que venga.
 *
 * Acepta la forma antigua (array de IDs de slot) además de la nueva para
 * que el orden de despliegue no importe: si la web nueva se abre antes de
 * que corra la migración, sigue mostrando la disponibilidad correcta.
 */
export function parseAvailability(raw: unknown): AvailabilityRange[] {
  if (!Array.isArray(raw)) return [];

  const out: AvailabilityRange[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const slot = TIME_SLOTS.find((s) => s.id === item);
      if (slot) out.push({ day: slot.day, from: slot.from, to: slot.to });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const day = o.day as SlotDay;
      const from = typeof o.from === 'string' ? o.from.slice(0, 5) : '';
      const to = typeof o.to === 'string' ? o.to.slice(0, 5) : '';
      if (AVAILABILITY_DAYS.includes(day) && from && to) {
        out.push({ day, from, to });
      }
    }
  }
  return normalizeRanges(out);
}

/**
 * Ordena, descarta lo inválido y fusiona lo que se toca o se solapa.
 * "09:00–10:30" y "10:30–12:00" el mismo día son "09:00–12:00".
 */
export function normalizeRanges(ranges: AvailabilityRange[]): AvailabilityRange[] {
  const out: AvailabilityRange[] = [];

  for (const day of AVAILABILITY_DAYS) {
    const ofDay = ranges
      .filter((r) => r.day === day && toMinutes(r.from) < toMinutes(r.to))
      .sort((a, b) => toMinutes(a.from) - toMinutes(b.from));

    for (const r of ofDay) {
      const last = out[out.length - 1];
      if (last && last.day === day && toMinutes(r.from) <= toMinutes(last.to)) {
        if (toMinutes(r.to) > toMinutes(last.to)) last.to = r.to;
      } else {
        out.push({ ...r });
      }
    }
  }
  return out;
}

/** ¿Algún rango de ese día contiene entera la franja [from, to)? */
export function coversInterval(
  ranges: AvailabilityRange[],
  day: SlotDay,
  from: string,
  to: string,
): boolean {
  return ranges.some(
    (r) =>
      r.day === day &&
      toMinutes(r.from) <= toMinutes(from) &&
      toMinutes(r.to) >= toMinutes(to),
  );
}

/** Horas de inicio de duración `minutes` que caben en el rango. */
export function startsWithin(r: AvailabilityRange, minutes: number): string[] {
  const out: string[] = [];
  if (minutes <= 0) return out;
  for (let m = toMinutes(r.from); m + minutes <= toMinutes(r.to); m += minutes) {
    out.push(fromMinutes(m));
  }
  return out;
}
