// Canales de "¿Cómo nos has conocido?" del formulario público.
//
// Se guarda el valor (estable, en inglés/slug) en leads.referral_source
// para poder agregarlo por canal. La etiqueta es lo que ve el padre.
//
// No renombrar valores existentes: rompería el histórico. Para retirar un
// canal, quítalo de la lista; los leads antiguos conservan su valor.

export type ReferralSourceOption = { value: string; label: string };

export const REFERRAL_SOURCES: ReferralSourceOption[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'friend', label: 'Un amigo o familiar' },
  { value: 'school', label: 'El colegio de mi hijo(a)' },
  { value: 'press', label: 'Nota de prensa' },
  { value: 'other', label: 'Otro' },
];

const BY_VALUE: Record<string, string> = Object.fromEntries(
  REFERRAL_SOURCES.map((s) => [s.value, s.label]),
);

export function referralSourceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return BY_VALUE[value] ?? value;
}
