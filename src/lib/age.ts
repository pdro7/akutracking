// Compact age label — years + months when we have a real birthdate,
// years-only when we only have age_at_enrollment (frozen integer).
// Formats: "8a 11m", "9a", "11m" (under 1 year).
export function computeAgeLabel(dob: string | null | undefined, fallback: number | null | undefined): string | null {
  if (dob) {
    const birth = new Date(dob + 'T12:00:00');
    if (!isNaN(birth.getTime())) {
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      if (now.getDate() < birth.getDate()) months--;
      if (months < 0) { years--; months += 12; }
      if (years < 0 || years > 120) return null;
      if (years === 0) return `${months}m`;
      if (months === 0) return `${years}a`;
      return `${years}a ${months}m`;
    }
  }
  if (typeof fallback === 'number' && fallback >= 0) return `${fallback}a`;
  return null;
}
