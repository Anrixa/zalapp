import { describe, expect, it } from 'vitest';
import {
  BALANCE_DUE_DAYS_BEFORE_EVENT,
  DEPOSIT_RATE,
  FREE_CANCELLATION_DAYS_BEFORE_EVENT,
  SERVICE_FEE_RATE,
  addDays,
  computeDeadlines,
  computeQuote,
  computeRefund,
  daysBetween,
  formatBookingRef,
  roundAmd,
} from '../src/pricing';

describe('computeQuote', () => {
  it('reproduces the worked example from the Checkout screen', () => {
    // 420,000 hall + 60,000 DJ, +5% service fee, 20% deposit.
    const quote = computeQuote({
      rentalAmd: 420_000,
      addOns: [{ id: 'addon_dj_0001', name: 'Live music & DJ', priceAmd: 60_000 }],
      discountAmd: 0,
    });

    expect(quote.subtotalAmd).toBe(480_000);
    expect(quote.serviceFeeAmd).toBe(24_000);
    expect(quote.totalAmd).toBe(504_000);
    expect(quote.depositAmd).toBe(100_800);
    expect(quote.balanceAmd).toBe(403_200);
  });

  it('keeps deposit and balance summing to the total whatever the rounding', () => {
    // Fuzz a wide range of prices; the invariant must not depend on nice numbers.
    for (let rental = 1; rental <= 200_000; rental += 997) {
      const quote = computeQuote({ rentalAmd: rental, addOns: [], discountAmd: 0 });
      expect(quote.depositAmd + quote.balanceAmd).toBe(quote.totalAmd);
      expect(quote.subtotalAmd + quote.serviceFeeAmd).toBe(quote.totalAmd);
      expect(Number.isInteger(quote.depositAmd)).toBe(true);
      expect(Number.isInteger(quote.serviceFeeAmd)).toBe(true);
    }
  });

  it('charges the service fee after the discount, not before', () => {
    const quote = computeQuote({
      rentalAmd: 400_000,
      addOns: [],
      discountAmd: 100_000,
      discountLabel: 'Weekday promo',
    });

    expect(quote.subtotalAmd).toBe(300_000);
    expect(quote.serviceFeeAmd).toBe(15_000);
    expect(quote.totalAmd).toBe(315_000);
  });

  it('never lets a discount push the total below zero', () => {
    const quote = computeQuote({ rentalAmd: 50_000, addOns: [], discountAmd: 999_999 });

    expect(quote.discountAmd).toBe(50_000);
    expect(quote.subtotalAmd).toBe(0);
    expect(quote.totalAmd).toBe(0);
    expect(quote.depositAmd).toBe(0);
    expect(quote.balanceAmd).toBe(0);
  });

  it('lists every add-on and the fee in display order', () => {
    const quote = computeQuote({
      rentalAmd: 420_000,
      addOns: [
        { id: 'addon_dj_0001', name: 'Live music & DJ', priceAmd: 60_000 },
        { id: 'addon_pho_001', name: 'Photography package', priceAmd: 90_000 },
      ],
      discountAmd: 0,
    });

    expect(quote.lines.map((line) => line.key)).toEqual([
      'rental',
      'addon:addon_dj_0001',
      'addon:addon_pho_001',
      'service_fee',
    ]);
    expect(quote.addOnsTotalAmd).toBe(150_000);
  });

  it('rejects a negative rental instead of quietly producing a credit note', () => {
    expect(() => computeQuote({ rentalAmd: -1, addOns: [], discountAmd: 0 })).toThrow();
  });

  it('uses the rates the design specifies', () => {
    expect(SERVICE_FEE_RATE).toBe(0.05);
    expect(DEPOSIT_RATE).toBe(0.2);
  });
});

describe('roundAmd', () => {
  it('rounds half away from zero in both directions', () => {
    expect(roundAmd(0.5)).toBe(1);
    expect(roundAmd(-0.5)).toBe(-1);
    expect(roundAmd(2.4)).toBe(2);
    expect(roundAmd(-2.4)).toBe(-2);
  });
});

describe('calendar arithmetic', () => {
  it('derives the deadlines shown on Confirmation for a 26 September event', () => {
    const deadlines = computeDeadlines('2026-09-26');

    expect(deadlines.balanceDueOn).toBe('2026-09-19');
    expect(deadlines.freeCancellationUntil).toBe('2026-09-12');
    expect(BALANCE_DUE_DAYS_BEFORE_EVENT).toBe(7);
    expect(FREE_CANCELLATION_DAYS_BEFORE_EVENT).toBe(14);
  });

  it('crosses month and year boundaries correctly', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // leap year
    expect(daysBetween('2026-09-19', '2026-09-26')).toBe(7);
    expect(daysBetween('2026-09-26', '2026-09-19')).toBe(-7);
  });

  it('is immune to the host machine time zone', () => {
    // Deliberately compute across a day boundary that a local-time
    // implementation would get wrong west of UTC.
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('computeRefund', () => {
  const eventDate = '2026-09-26';

  it('returns everything inside the free-cancellation window', () => {
    const outcome = computeRefund({
      eventDate,
      paidAmd: 100_800,
      depositAmd: 100_800,
      onDate: '2026-09-01',
    });

    expect(outcome.isFree).toBe(true);
    expect(outcome.refundAmd).toBe(100_800);
    expect(outcome.forfeitedAmd).toBe(0);
  });

  it('treats the boundary day itself as still free', () => {
    const outcome = computeRefund({
      eventDate,
      paidAmd: 100_800,
      depositAmd: 100_800,
      onDate: '2026-09-12',
    });

    expect(outcome.isFree).toBe(true);
  });

  it('forfeits only the deposit once the window has closed', () => {
    const outcome = computeRefund({
      eventDate,
      paidAmd: 504_000,
      depositAmd: 100_800,
      onDate: '2026-09-13',
    });

    expect(outcome.isFree).toBe(false);
    expect(outcome.forfeitedAmd).toBe(100_800);
    expect(outcome.refundAmd).toBe(403_200);
  });

  it('never forfeits more than was actually paid', () => {
    const outcome = computeRefund({
      eventDate,
      paidAmd: 40_000,
      depositAmd: 100_800,
      onDate: '2026-09-20',
    });

    expect(outcome.forfeitedAmd).toBe(40_000);
    expect(outcome.refundAmd).toBe(0);
  });
});

describe('formatBookingRef', () => {
  it('matches the reference on the Confirmation screen', () => {
    expect(formatBookingRef('2026-09-26', 7)).toBe('ZAL-20260926-07');
    expect(formatBookingRef('2026-11-06', 123)).toBe('ZAL-20261106-123');
  });
});
