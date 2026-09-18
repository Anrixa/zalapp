/**
 * Calendar-date helpers.
 *
 * Prisma gives back a JS `Date` for a `@db.Date` column, set to UTC midnight.
 * These convert between that and the `YYYY-MM-DD` strings the contract uses,
 * always through UTC so a server in any zone produces the same string.
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Today as a calendar date, in the venue's zone rather than the server's. */
export function todayInYerevan(now: Date = new Date()): string {
  // Armenia is UTC+4 year-round — no daylight saving since 2012.
  const shifted = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = fromIsoDate(from);
  const end = fromIsoDate(to);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Friday, Saturday or Sunday — when weekend pricing applies. */
export function isWeekend(isoDate: string): boolean {
  const day = fromIsoDate(isoDate).getUTCDay();
  return day === 5 || day === 6 || day === 0;
}

/** "August 2026" for the review byline. */
export function formatMonthYear(date: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
