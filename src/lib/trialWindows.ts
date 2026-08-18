// Ventanas de clases de prueba.
//
// El admin decide qué días y horas se pueden agendar — igual que en
// Calendly. La disponibilidad de los profesores (teachers.availability,
// que usa el catálogo de src/lib/timeSlots.ts) sólo sirve para SUGERIR
// ventanas: "Juan tiene libre los martes por la tarde". Nunca genera
// huecos por sí sola.

import { type SlotDay } from './timeSlots';
import { parseAvailability } from './availability';

// weekday se guarda como en extract(dow) de Postgres y getDay() de JS:
// 0 = domingo … 6 = sábado.
export const WEEKDAY_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const SLOT_DAY_TO_WEEKDAY: Record<SlotDay, number> = {
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export type TrialWindow = {
  id: string;
  weekday: number;
  /** Inicio del rango de apertura, no de una clase concreta. */
  start_time: string;
  end_time: string;
  /** Estudiantes por clase. 1 = individual. */
  capacity: number;
  /** Duración de cada clase. Null = settings.trial_duration_minutes. */
  slot_duration_minutes: number | null;
  is_active: boolean;
  source_slot_id: string | null;
};

export type WindowSuggestion = {
  weekday: number;
  start_time: string;
  end_time: string;
  source_slot_id: string;
  teachers: string[];
};

type TeacherLike = {
  name: string;
  is_active?: boolean | null;
  availability?: unknown;
};

// "HH:MM:SS" → "HH:MM". Postgres devuelve time con segundos.
export function hhmm(t: string | null | undefined): string {
  return (t ?? '').slice(0, 5);
}

function minutesOf(t: string): number {
  const [h, m] = hhmm(t).split(':').map(Number);
  return h * 60 + m;
}

/**
 * Cuántas clases de `duration` minutos caben en la ventana. Es la misma
 * cuenta que hace get_trial_availability al subdividirla: el resto que no
 * completa una clase se descarta.
 */
export function slotsIn(start: string, end: string, duration: number): number {
  if (!start || !end || duration <= 0) return 0;
  return Math.floor((minutesOf(end) - minutesOf(start)) / duration);
}

/** Horas de inicio que generará una ventana, para previsualizarla. */
export function slotStarts(start: string, end: string, duration: number): string[] {
  const n = slotsIn(start, end, duration);
  const base = minutesOf(start);
  return Array.from({ length: Math.max(n, 0) }, (_, i) => {
    const m = base + i * duration;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  });
}

/**
 * Deriva ventanas candidatas de la disponibilidad declarada por los
 * profesores. Cada rango declarado se propone tal cual, con la lista de
 * quienes lo cubren, para que el admin vea con quién contaría.
 *
 * Dos profesores con el mismo rango dan una sola sugerencia; con rangos
 * distintos dan una cada uno, que es lo correcto: son ofertas distintas.
 */
export function suggestWindowsFromTeachers(
  teachers: TeacherLike[],
): WindowSuggestion[] {
  const byRange = new Map<string, { day: SlotDay; from: string; to: string; names: string[] }>();

  for (const t of teachers) {
    if (t.is_active === false) continue;
    for (const r of parseAvailability(t.availability)) {
      const key = `${r.day}-${r.from}-${r.to}`;
      const entry = byRange.get(key) ?? { day: r.day, from: r.from, to: r.to, names: [] };
      entry.names.push(t.name);
      byRange.set(key, entry);
    }
  }

  const out: WindowSuggestion[] = [];
  for (const [key, e] of byRange) {
    out.push({
      weekday: SLOT_DAY_TO_WEEKDAY[e.day],
      start_time: e.from,
      end_time: e.to,
      source_slot_id: key,
      teachers: e.names.sort(),
    });
  }

  // Lunes primero, domingo al final, y por hora dentro del día.
  return out.sort(
    (a, b) =>
      WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
      a.start_time.localeCompare(b.start_time),
  );
}

/**
 * TEACHER_CONFLICT viene como "TEACHER_CONFLICT: Clase individual con X (11:00–12:00)".
 * Devuelve la descripción de la clase que choca, o null si el error es otro.
 */
export function extractTeacherConflict(raw: string): string | null {
  const m = raw.match(/TEACHER_CONFLICT:\s*(.+)/);
  return m ? m[1].trim() : null;
}

/**
 * Los errores del RPC book_trial_slot vienen como códigos en mayúsculas.
 * Se traducen aquí para no repetir los textos en cada pantalla.
 */
export function translateBookingError(raw: string): string {
  const conflict = extractTeacherConflict(raw);
  if (conflict) {
    return `El profesor ya tiene ${conflict} a esa hora.`;
  }
  if (raw.includes('SLOT_TAKEN')) {
    return 'Ese horario acaba de ocuparse. Elige otro.';
  }
  if (raw.includes('SLOT_UNAVAILABLE')) {
    return 'Ese horario ya no está disponible. Actualiza la lista o fuerza el horario.';
  }
  if (raw.includes('NO_TEACHER_AVAILABLE')) {
    return 'No hay ningún profesor libre en esa franja.';
  }
  if (raw.includes('CROSSES_MIDNIGHT')) {
    return 'La clase terminaría después de medianoche. Elige una hora más temprana.';
  }
  if (raw.includes('MISSING_ARGS')) {
    return 'Faltan la fecha o la hora.';
  }
  return raw;
}

/** ¿Esta sugerencia ya existe como ventana configurada? */
export function isAlreadyConfigured(
  s: WindowSuggestion,
  windows: TrialWindow[],
): boolean {
  return windows.some(
    (w) =>
      w.weekday === s.weekday &&
      hhmm(w.start_time) === s.start_time &&
      hhmm(w.end_time) === s.end_time,
  );
}
