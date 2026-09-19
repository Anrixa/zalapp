import { describe, expect, it } from 'vitest';
import { publishBlockers, MIN_DESCRIPTION_LENGTH } from '../src/modules/venues/publish-blockers';
import {
  BALANCE_REMINDER_DAYS_BEFORE_DUE,
  balanceReminderTarget,
  balanceReminderWindow,
  holdCutoff,
} from '../src/modules/tasks/schedule-math';

const ready = {
  images: [{}],
  prices: [{ slot: 'AFTERNOON' }, { slot: 'EVENING' }],
  description: 'A grand ballroom in the heart of Kentron with six-metre ceilings.',
  capacityMax: 250,
};

describe('publishBlockers', () => {
  it('lets a complete venue through', () => {
    expect(publishBlockers(ready)).toEqual([]);
  });

  it('will not publish a venue with no photos', () => {
    expect(publishBlockers({ ...ready, images: [] })).toContain('add at least one photo');
  });

  it('names the slot that has no price, not just "prices"', () => {
    const blockers = publishBlockers({ ...ready, prices: [{ slot: 'EVENING' }] });
    expect(blockers).toContain('set a price for the afternoon');
  });

  it('lists both slots when neither is priced', () => {
    const blockers = publishBlockers({ ...ready, prices: [] });
    expect(blockers).toContain('set a price for the afternoon and evening');
  });

  it('rejects a description that says nothing', () => {
    expect(publishBlockers({ ...ready, description: 'Nice hall' })).toContain(
      'write a longer description',
    );
    // Whitespace is not a description.
    expect(publishBlockers({ ...ready, description: ' '.repeat(80) })).toContain(
      'write a longer description',
    );
  });

  it('accepts a description exactly at the threshold', () => {
    const exact = 'x'.repeat(MIN_DESCRIPTION_LENGTH);
    expect(publishBlockers({ ...ready, description: exact })).toEqual([]);
  });

  it('collects every problem at once rather than one at a time', () => {
    const blockers = publishBlockers({
      images: [],
      prices: [],
      description: '',
      capacityMax: 0,
    });
    expect(blockers).toHaveLength(4);
  });
});

describe('balanceReminderTarget', () => {
  it('looks three days ahead of the run date', () => {
    expect(BALANCE_REMINDER_DAYS_BEFORE_DUE).toBe(3);
    expect(balanceReminderTarget('2026-09-16')).toBe('2026-09-19');
  });

  it('lands on the balance due date of a 26 September event', () => {
    // Balance is due 7 days before the event, so 19 September; the reminder
    // therefore goes out on the 16th.
    expect(balanceReminderTarget('2026-09-16')).toBe('2026-09-19');
  });

  it('crosses month and year boundaries', () => {
    expect(balanceReminderTarget('2026-09-29')).toBe('2026-10-02');
    expect(balanceReminderTarget('2026-12-30')).toBe('2027-01-02');
    expect(balanceReminderTarget('2028-02-27')).toBe('2028-03-01'); // leap year
  });
});

describe('balanceReminderWindow', () => {
  it('runs from today to the target, so a missed run is picked up tomorrow', () => {
    expect(balanceReminderWindow('2026-09-16')).toEqual({
      from: '2026-09-16',
      to: '2026-09-19',
    });
  });

  it("still covers yesterday's cohort after a deploy straddles the run", () => {
    // A guest whose balance falls due on the 19th should have been told on the
    // 16th. If that run never fired, the 17th's window (17th-20th) still
    // contains the 19th, and the already-notified check stops a double send.
    const missed = balanceReminderTarget('2026-09-16');
    const nextDay = balanceReminderWindow('2026-09-17');
    expect(missed >= nextDay.from && missed <= nextDay.to).toBe(true);
  });

  it('crosses a month boundary at both ends', () => {
    expect(balanceReminderWindow('2026-09-29')).toEqual({
      from: '2026-09-29',
      to: '2026-10-02',
    });
  });
});

describe('holdCutoff', () => {
  it('is the hold window behind the given instant', () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    expect(holdCutoff(now, 60).toISOString()).toBe('2026-09-19T11:00:00.000Z');
    expect(holdCutoff(now, 30).toISOString()).toBe('2026-09-19T11:30:00.000Z');
  });
});
