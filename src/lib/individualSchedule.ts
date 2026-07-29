// Weekly pattern for individual (1-on-1) students.
// Any number of {day, start_time, end_time} entries; the generator
// walks the calendar forward and emits N concrete sessions.

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WeeklySlot = {
  day: WeekDay;
  start_time: string; // "HH:MM"
  end_time?: string | null;
};

export const WEEKDAY_LABEL: Record<WeekDay, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

export const WEEKDAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// JS Date.getDay(): Sunday=0, Monday=1, ... Saturday=6
const JS_TO_WD: Record<number, WeekDay> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export type GeneratedSession = {
  scheduled_date: string; // YYYY-MM-DD
  scheduled_start_time: string; // HH:MM
  scheduled_end_time: string | null;
};

// Given a start date (inclusive), a weekly pattern, and a target number of
// sessions, walk day-by-day and emit sessions until we hit the target.
// Each pattern entry contributes one session per matching weekday of the week.
export function generateIndividualSessions(
  startDateISO: string,
  pattern: WeeklySlot[],
  count: number,
): GeneratedSession[] {
  if (!pattern.length || count <= 0) return [];

  // Group pattern by day for quick lookup: day → [WeeklySlot,...] sorted by time.
  const byDay = new Map<WeekDay, WeeklySlot[]>();
  for (const p of pattern) {
    const arr = byDay.get(p.day) ?? [];
    arr.push(p);
    byDay.set(p.day, arr);
  }
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const out: GeneratedSession[] = [];
  const start = new Date(startDateISO + 'T12:00:00');
  const MAX_DAYS = 365 * 3; // sanity ceiling — 3 years forward

  for (let i = 0; i < MAX_DAYS && out.length < count; i++) {
    const d = addDays(start, i);
    const wd = JS_TO_WD[d.getDay()];
    const slots = byDay.get(wd);
    if (!slots) continue;
    for (const s of slots) {
      if (out.length >= count) break;
      out.push({
        scheduled_date: toISODate(d),
        scheduled_start_time: s.start_time,
        scheduled_end_time: s.end_time ?? null,
      });
    }
  }
  return out;
}

export function formatWeeklyPattern(pattern: WeeklySlot[]): string {
  if (!pattern.length) return 'Sin patrón definido';
  // Group by identical time range so "Mar y Jue 16:00–17:00" is compact.
  const byTime = new Map<string, WeekDay[]>();
  for (const p of pattern) {
    const key = `${p.start_time}|${p.end_time ?? ''}`;
    const arr = byTime.get(key) ?? [];
    arr.push(p.day);
    byTime.set(key, arr);
  }
  const parts: string[] = [];
  for (const [key, days] of byTime) {
    const [start, end] = key.split('|');
    const dayLabels = days
      .map((d) => WEEKDAYS.indexOf(d))
      .sort((a, b) => a - b)
      .map((i) => WEEKDAY_LABEL[WEEKDAYS[i]]);
    parts.push(`${dayLabels.join(' y ')} ${start}${end ? '–' + end : ''}`);
  }
  return parts.join(' · ');
}
