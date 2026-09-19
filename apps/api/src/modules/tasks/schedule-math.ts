/**
 * Date arithmetic for the scheduled jobs.
 *
 * Separated from the service so it can be tested without a database or a
 * clock. Off-by-one errors here are invisible in review and obvious to a guest
 * who gets reminded about a payment on the day it was already due.
 */

/**
 * How many days before the balance falls due the guest is reminded.
 *
 * The balance itself is due 7 days before the event, so 3 leaves time to move
 * money without the reminder landing so early it gets filed away and forgotten.
 */
export const BALANCE_REMINDER_DAYS_BEFORE_DUE = 3;

/**
 * Which `balanceDueOn` date today's reminder run is aiming at.
 *
 * Exactly `BALANCE_REMINDER_DAYS_BEFORE_DUE` days out — the date a guest should
 * hear about today if every run has fired on time.
 */
export function balanceReminderTarget(
  today: string,
  daysBefore = BALANCE_REMINDER_DAYS_BEFORE_DUE,
): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysBefore);
  return date.toISOString().slice(0, 10);
}

/**
 * The `balanceDueOn` range today's run should sweep: today through the target.
 *
 * A single exact date would be tidier, but `@nestjs/schedule` does not replay a
 * fire it missed — a deploy that straddles 10:00 would drop that day's cohort
 * for good, and they would learn about the balance when it was already overdue.
 * Sweeping the whole window costs nothing, because the "already notified" check
 * is what actually decides who gets a message; the arithmetic only bounds the
 * query.
 */
export function balanceReminderWindow(
  today: string,
  daysBefore = BALANCE_REMINDER_DAYS_BEFORE_DUE,
): { from: string; to: string } {
  return { from: today, to: balanceReminderTarget(today, daysBefore) };
}

/** The instant before which an unpaid hold has outlived its welcome. */
export function holdCutoff(now: Date, holdMinutes: number): Date {
  return new Date(now.getTime() - holdMinutes * 60_000);
}
