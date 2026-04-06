/**
 * Given a date and a list of holiday strings (YYYY-MM-DD),
 * returns the same date if it's not a holiday, or pushes it
 * forward by 7 days (recursively) until it lands on a non-holiday.
 */
export function skipHolidays(date: Date, holidays: string[]): Date {
  if (!holidays || holidays.length === 0) return date;
  const dateStr = date.toISOString().split('T')[0];
  if (holidays.includes(dateStr)) {
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    return skipHolidays(next, holidays);
  }
  return date;
}

/**
 * Generates N weekly session dates starting from startDate,
 * skipping any dates that fall on holidays.
 */
export function generateSessionDates(startDate: string, count: number, holidays: string[]): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + i * 7);
    const adjusted = skipHolidays(d, holidays);
    dates.push(adjusted.toISOString().split('T')[0]);
  }
  return dates;
}
