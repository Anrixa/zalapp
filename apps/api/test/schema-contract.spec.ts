import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AmenityCode,
  AvailabilityStatus,
  BookingStatus,
  Currency,
  DevicePlatform,
  EventType,
  Locale,
  NotificationType,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  TimeSlot,
  UserRole,
  VenueType,
} from '@zal/contracts';

/**
 * The database and the contract have to agree.
 *
 * Prisma's enums and the contract's enums are written twice, in two languages,
 * and nothing in the type system connects them: add `OUTDOOR` to the schema and
 * forget the contract, and the API happily returns a value every client will
 * fail to parse — at runtime, in production, on one venue out of two hundred.
 *
 * This reads `schema.prisma` as text rather than importing the generated
 * client, so it runs without `prisma generate` and without a database. That
 * matters: the check is most useful in environments where the Prisma engine
 * download is unavailable, which is exactly where nothing else would catch the
 * drift.
 */
function prismaEnums(): Record<string, string[]> {
  const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const found: Record<string, string[]> = {};

  for (const match of schema.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
    const name = match[1] as string;
    found[name] = (match[2] as string)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'));
  }

  return found;
}

const PAIRS: [string, Record<string, string>][] = [
  ['UserRole', UserRole],
  ['Locale', Locale],
  ['Currency', Currency],
  ['VenueType', VenueType],
  ['TimeSlot', TimeSlot],
  ['EventType', EventType],
  ['AvailabilityStatus', AvailabilityStatus],
  ['BookingStatus', BookingStatus],
  ['PaymentProvider', PaymentProvider],
  ['PaymentKind', PaymentKind],
  ['PaymentStatus', PaymentStatus],
  ['NotificationType', NotificationType],
  ['AmenityCode', AmenityCode],
  ['DevicePlatform', DevicePlatform],
];

describe('schema ↔ contract', () => {
  const schemaEnums = prismaEnums();

  it.each(PAIRS)('%s has the same members in both', (name, contractEnum) => {
    expect(schemaEnums[name], `enum ${name} is missing from schema.prisma`).toBeDefined();
    expect([...(schemaEnums[name] ?? [])].sort()).toEqual(Object.keys(contractEnum).sort());
  });

  it('covers every enum the schema declares', () => {
    // A new Prisma enum that no contract mirrors is either an oversight or a
    // deliberately internal one; either way it should be a decision, not a
    // silent omission.
    const internal = new Set(['VenueStatus', 'VerificationPurpose']);
    const declared = Object.keys(schemaEnums).filter((name) => !internal.has(name));
    const checked = PAIRS.map(([name]) => name);

    expect(declared.sort()).toEqual(checked.sort());
  });

  /**
   * The unique index is the actual double-booking guard — the availability
   * check before it is only a courtesy to the UI. Losing it would not fail a
   * single test elsewhere; it would just let two guests book the same Saturday.
   */
  it('keeps the unique index that prevents double bookings', () => {
    const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('@@unique([venueId, date, slot])');
  });

  it('stores event dates as calendar dates, not timestamps', () => {
    const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
    for (const field of ['eventDate', 'balanceDueOn', 'freeCancellationUntil']) {
      expect(schema).toMatch(new RegExp(`${field}\\s+DateTime\\s+@db\\.Date`));
    }
  });

  it('stores money as integers', () => {
    const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
    const floats = [...schema.matchAll(/^\s*(\w*Amd)\s+Float/gm)].map((match) => match[1]);
    expect(floats).toEqual([]);
  });
});
