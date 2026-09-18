import { z } from 'zod';
import { amdSchema, idSchema, isoDateSchema, type IsoDate } from './common';

/**
 * The pricing engine.
 *
 * This is the only implementation of Zal's money rules in the repository.
 * The API calls it when it writes a booking; the clients call it to draw the
 * "Price details" panel before anything is written. Because both sides run the
 * same function over the same inputs, the number the guest agrees to on the
 * Checkout screen is the number the server stores — there is no second formula
 * to drift out of step.
 *
 * Rules, all taken from the Zal design:
 *   • service fee   5% of (hall rental + add-ons)
 *   • deposit      20% of the total, due at booking
 *   • balance       the rest, due 7 days before the event
 *   • cancellation  free until 14 days before the event; after that the
 *                   deposit is forfeit and everything above it is returned
 *
 * Worked example from the Checkout screen:
 *   420,000 rental + 60,000 DJ = 480,000
 *   + 5% service fee (24,000)  = 504,000 total
 *   20% deposit                = 100,800 due today
 *   balance                    = 403,200 due 7 days before
 */

export const SERVICE_FEE_RATE = 0.05;
export const DEPOSIT_RATE = 0.2;
export const BALANCE_DUE_DAYS_BEFORE_EVENT = 7;
export const FREE_CANCELLATION_DAYS_BEFORE_EVENT = 14;

/**
 * Round to whole dram, half away from zero.
 *
 * `Math.round` rounds half *up*, which is asymmetric for negatives; refunds are
 * negative amounts, so rounding is made explicit here rather than inherited.
 */
export function roundAmd(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export const quoteLineSchema = z.object({
  /** Stable key so clients can localise the label instead of printing the server's. */
  key: z.string().min(1).max(64),
  /** Human label in the venue's own words, e.g. an add-on name. */
  label: z.string().min(1).max(120),
  amountAmd: z.number().int(),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;

export const quoteAddOnInputSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  priceAmd: amdSchema,
});
export type QuoteAddOnInput = z.infer<typeof quoteAddOnInputSchema>;

export const quoteInputSchema = z.object({
  /** Slot price for the chosen date, already resolved against any date override. */
  rentalAmd: amdSchema,
  addOns: z.array(quoteAddOnInputSchema).max(20).default([]),
  /** Flat discount in AMD, e.g. from a promo code. Never pushes the total below zero. */
  discountAmd: amdSchema.default(0),
  discountLabel: z.string().max(120).optional(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const quoteSchema = z.object({
  rentalAmd: z.number().int(),
  addOnsTotalAmd: z.number().int(),
  discountAmd: z.number().int(),
  /** rental + add-ons − discount. What the service fee is charged on. */
  subtotalAmd: z.number().int(),
  serviceFeeAmd: z.number().int(),
  totalAmd: z.number().int(),
  depositAmd: z.number().int(),
  balanceAmd: z.number().int(),
  serviceFeeRate: z.number(),
  depositRate: z.number(),
  /** Ready-to-render breakdown, in display order. */
  lines: z.array(quoteLineSchema),
});
export type Quote = z.infer<typeof quoteSchema>;

/**
 * Turn a rental price and a set of chosen add-ons into the full money picture.
 *
 * Pure: same inputs, same output, no clock and no I/O — which is what makes it
 * safe to run on the client and trustworthy to run on the server.
 */
export function computeQuote(input: QuoteInput): Quote {
  const { rentalAmd, addOns, discountAmd, discountLabel } = quoteInputSchema.parse(input);

  const addOnsTotalAmd = addOns.reduce((sum, addOn) => sum + addOn.priceAmd, 0);
  const gross = rentalAmd + addOnsTotalAmd;

  // A promo can never turn into a payout.
  const appliedDiscount = Math.min(discountAmd, gross);
  const subtotalAmd = gross - appliedDiscount;

  const serviceFeeAmd = roundAmd(subtotalAmd * SERVICE_FEE_RATE);
  const totalAmd = subtotalAmd + serviceFeeAmd;
  const depositAmd = roundAmd(totalAmd * DEPOSIT_RATE);

  // Derive the balance by subtraction so the two parts always sum to the total,
  // whichever way each one rounded.
  const balanceAmd = totalAmd - depositAmd;

  const lines: QuoteLine[] = [
    { key: 'rental', label: 'Hall rental', amountAmd: rentalAmd },
    ...addOns.map((addOn) => ({
      key: `addon:${addOn.id}`,
      label: addOn.name,
      amountAmd: addOn.priceAmd,
    })),
  ];
  if (appliedDiscount > 0) {
    lines.push({
      key: 'discount',
      label: discountLabel ?? 'Discount',
      amountAmd: -appliedDiscount,
    });
  }
  lines.push({ key: 'service_fee', label: 'Service fee', amountAmd: serviceFeeAmd });

  return {
    rentalAmd,
    addOnsTotalAmd,
    discountAmd: appliedDiscount,
    subtotalAmd,
    serviceFeeAmd,
    totalAmd,
    depositAmd,
    balanceAmd,
    serviceFeeRate: SERVICE_FEE_RATE,
    depositRate: DEPOSIT_RATE,
    lines,
  };
}

/* ── Calendar helpers ──────────────────────────────────────────────────────
 * Event dates are calendar dates. Arithmetic is done at UTC midnight so that
 * "7 days before" never lands a day out because the server happens to run in a
 * different zone from the venue.
 */

export function parseIsoDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = parseIsoDate(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatIsoDate(shifted);
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export const bookingDeadlinesSchema = z.object({
  eventDate: isoDateSchema,
  balanceDueOn: isoDateSchema,
  freeCancellationUntil: isoDateSchema,
});
export type BookingDeadlines = z.infer<typeof bookingDeadlinesSchema>;

/**
 * The two dates every booking carries.
 *
 * For a 26 September event: balance due 19 September, free cancellation through
 * 12 September — which is what the Confirmation and Booking detail screens show.
 */
export function computeDeadlines(eventDate: IsoDate): BookingDeadlines {
  return {
    eventDate,
    balanceDueOn: addDays(eventDate, -BALANCE_DUE_DAYS_BEFORE_EVENT),
    freeCancellationUntil: addDays(eventDate, -FREE_CANCELLATION_DAYS_BEFORE_EVENT),
  };
}

export const refundOutcomeSchema = z.object({
  /** Whether the guest is inside the free-cancellation window. */
  isFree: z.boolean(),
  refundAmd: z.number().int().min(0),
  forfeitedAmd: z.number().int().min(0),
  freeCancellationUntil: isoDateSchema,
});
export type RefundOutcome = z.infer<typeof refundOutcomeSchema>;

/**
 * What a guest gets back if they cancel on `onDate`.
 *
 * Inside the window every dram paid is returned. Outside it the deposit is
 * forfeit and anything paid beyond the deposit — typically a settled balance —
 * still comes back, because that money bought a date the venue can now resell.
 */
export function computeRefund(params: {
  eventDate: IsoDate;
  paidAmd: number;
  depositAmd: number;
  onDate: IsoDate;
}): RefundOutcome {
  const { eventDate, paidAmd, depositAmd, onDate } = params;
  const { freeCancellationUntil } = computeDeadlines(eventDate);
  const isFree = daysBetween(onDate, freeCancellationUntil) >= 0;

  if (isFree) {
    return { isFree: true, refundAmd: paidAmd, forfeitedAmd: 0, freeCancellationUntil };
  }

  const forfeitedAmd = Math.min(paidAmd, depositAmd);
  return {
    isFree: false,
    refundAmd: paidAmd - forfeitedAmd,
    forfeitedAmd,
    freeCancellationUntil,
  };
}

/** Booking references read out over the phone: `ZAL-20260926-07`. */
export function formatBookingRef(eventDate: IsoDate, sequence: number): string {
  const compact = eventDate.replaceAll('-', '');
  return `ZAL-${compact}-${String(sequence).padStart(2, '0')}`;
}
