import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, paginate } from './cursor';
import {
  eachDate,
  formatMonthYear,
  fromIsoDate,
  isWeekend,
  toIsoDate,
  todayInYerevan,
} from './dates';
import { initialsFrom, slugify } from './text';

describe('cursors', () => {
  it('round-trips a value', () => {
    expect(decodeCursor(encodeCursor('clx123'))).toBe('clx123');
  });

  it('treats junk as no cursor rather than throwing', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('only reports a next page when one more row came back', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const full = paginate(rows, 2, (row) => row.id);
    expect(full.items).toHaveLength(2);
    expect(full.nextCursor).toBe(encodeCursor('b'));

    const last = paginate(rows, 3, (row) => row.id);
    expect(last.items).toHaveLength(3);
    expect(last.nextCursor).toBeNull();
  });

  it('handles an empty result', () => {
    expect(paginate([], 20, () => '')).toEqual({ items: [], nextCursor: null });
  });
});

describe('dates', () => {
  it('converts between Prisma dates and ISO calendar dates', () => {
    expect(toIsoDate(fromIsoDate('2026-09-26'))).toBe('2026-09-26');
  });

  it('enumerates an inclusive range', () => {
    expect(eachDate('2026-09-28', '2026-10-02')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('treats Friday, Saturday and Sunday as the weekend', () => {
    // 2026-09-25 is a Friday.
    expect(isWeekend('2026-09-25')).toBe(true);
    expect(isWeekend('2026-09-26')).toBe(true);
    expect(isWeekend('2026-09-27')).toBe(true);
    expect(isWeekend('2026-09-28')).toBe(false);
  });

  it('uses Yerevan time for "today", not the server zone', () => {
    // 22:30 UTC is already the next day in Armenia (UTC+4).
    expect(todayInYerevan(new Date('2026-09-26T22:30:00Z'))).toBe('2026-09-27');
    expect(todayInYerevan(new Date('2026-09-26T10:00:00Z'))).toBe('2026-09-26');
  });

  it('formats a review byline', () => {
    expect(formatMonthYear(fromIsoDate('2026-08-14'))).toBe('August 2026');
  });
});

describe('text', () => {
  it('builds avatar initials from one or two names', () => {
    expect(initialsFrom('Marine Kirakosyan')).toBe('MK');
    expect(initialsFrom('Ani')).toBe('A');
    expect(initialsFrom('  ')).toBe('?');
  });

  it('takes initials from Armenian names too', () => {
    expect(initialsFrom('Անի Սարգսյան')).toBe('ԱՍ');
  });

  it('slugs venue names', () => {
    expect(slugify('Dvin Hall')).toBe('dvin-hall');
    expect(slugify('  Nairi   Banquet House! ')).toBe('nairi-banquet-house');
  });
});
