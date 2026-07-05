// Shared catalog of scheduling slots used across the demand-driven
// group formation feature. Leads pick the slots that work for their
// child; teachers pick the slots they can teach; the matcher joins
// leads and teachers by the intersection of their slot sets.
//
// Slot IDs are stable and stored in leads.preferred_slots and
// teachers.availability as JSON arrays. Never renumber existing IDs —
// add new ones instead.

export type SlotDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type SlotBucket = 'sat-am' | 'sat-pm' | 'wk-am' | 'wk-pm';

export type TimeSlot = {
  id: string;
  day: SlotDay;
  from: string;
  to: string;
  label: string;
  bucket: SlotBucket;
};

const DAY_LABEL: Record<SlotDay, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
};

const WEEKDAYS: SlotDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

function slot(day: SlotDay, from: string, to: string, bucket: SlotBucket): TimeSlot {
  return {
    id: `${day}-${bucket.endsWith('am') ? 'am' : 'pm'}-${from.replace(':', '')}`,
    day,
    from,
    to,
    label: `${DAY_LABEL[day]} ${from}–${to}`,
    bucket,
  };
}

export const TIME_SLOTS: TimeSlot[] = [
  slot('sat', '09:00', '10:30', 'sat-am'),
  slot('sat', '10:30', '12:00', 'sat-am'),
  slot('sat', '14:00', '15:30', 'sat-pm'),
  slot('sat', '15:30', '17:00', 'sat-pm'),

  ...WEEKDAYS.flatMap((d) => [slot(d, '09:00', '10:30', 'wk-am')]),

  ...WEEKDAYS.flatMap((d) => [slot(d, '16:30', '18:00', 'wk-pm')]),
];

export const BUCKET_LABEL: Record<SlotBucket, string> = {
  'sat-am': 'Sábados mañana',
  'sat-pm': 'Sábados tarde',
  'wk-am': 'Entre semana (mañana)',
  'wk-pm': 'Entre semana (tarde)',
};

export const SLOTS_BY_BUCKET: Record<SlotBucket, TimeSlot[]> = {
  'sat-am': TIME_SLOTS.filter((s) => s.bucket === 'sat-am'),
  'sat-pm': TIME_SLOTS.filter((s) => s.bucket === 'sat-pm'),
  'wk-am': TIME_SLOTS.filter((s) => s.bucket === 'wk-am'),
  'wk-pm': TIME_SLOTS.filter((s) => s.bucket === 'wk-pm'),
};

const BY_ID: Record<string, TimeSlot> = Object.fromEntries(
  TIME_SLOTS.map((s) => [s.id, s]),
);

export function getSlot(id: string): TimeSlot | undefined {
  return BY_ID[id];
}

export function getSlotLabel(id: string): string {
  return BY_ID[id]?.label ?? id;
}
