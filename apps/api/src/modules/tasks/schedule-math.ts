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
 * Which `balanceDueOn` date today's reminder run should look for.
 *
 * Runs at a fixed date rather than a range: a range would re-notify every day
 * until the balance was paid, and the "already sent" check would be doing work
 * the arithmetic should have avoided.
 */
export function balanceReminderTarget(
  today: string,
  daysBefore = BALANCE_REMINDER_DAYS_BEFORE_DUE,
): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysBefore);
  return date.toISOString().slice(0, 10);
}

/** The instant before which an unpaid hold has outlived its welcome. */
export function holdCutoff(now: Date, holdMinutes: number): Date {
  return new Date(now.getTime() - holdMinutes * 60_000);
}
