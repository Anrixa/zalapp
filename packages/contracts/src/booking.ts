import { z } from 'zod';
import {
  amdSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  paginationQuerySchema,
} from './common';
import { bookingBucketSchema, bookingStatusSchema, eventTypeSchema, timeSlotSchema } from './enums';
import { quoteSchema, refundOutcomeSchema } from './pricing';
import { venueSummarySchema } from './venue';
import { hostSchema } from './user';

export const bookingAddOnSchema = z.object({
  id: idSchema,
  addOnId: idSchema,
  name: z.string().min(1).max(120),
  priceAmd: amdSchema,
});
export type BookingAddOn = z.infer<typeof bookingAddOnSchema>;

/** A row on My bookings. */
export const bookingSummarySchema = z.object({
  id: idSchema,
  ref: z.string().min(6).max(32),
  status: bookingStatusSchema,
  eventDate: isoDateSchema,
  slot: timeSlotSchema,
  guestCount: z.number().int().positive(),
  eventType: eventTypeSchema,
  totalAmd: amdSchema,
  paidAmd: amdSchema,
  venue: venueSummarySchema,
});
export type BookingSummary = z.infer<typeof bookingSummarySchema>;

export const bookingDetailSchema = bookingSummarySchema.extend({
  addOns: z.array(bookingAddOnSchema),
  quote: quoteSchema,
  depositAmd: amdSchema,
  balanceAmd: amdSchema,
  balanceDueOn: isoDateSchema,
  freeCancellationUntil: isoDateSchema,
  /** Null until the guest is inside a window where cancelling is still possible. */
  cancellationPreview: refundOutcomeSchema.nullable(),
  host: hostSchema,
  note: z.string().max(1000).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  confirmedAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  conversationId: idSchema.nullable(),
  /**
   * Whether this booking has already been reviewed.
   *
   * Carried on the booking rather than discovered by attempting to post one:
   * offering a form and then rejecting it is a worse answer than not offering
   * it, and the server refuses a second review either way.
   */
  hasReview: z.boolean(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;

/**
 * Create a booking.
 *
 * The client sends what the guest chose, never what it costs: the API
 * re-resolves the rental price and re-runs `computeQuote`, so a tampered body
 * changes nothing. `expectedTotalAmd` is optional and advisory — when present
 * and different from the server's figure the request is rejected, which catches
 * the honest case where the price moved between the Checkout screen loading and
 * the guest pressing the button.
 */
export const createBookingSchema = z.object({
  venueId: idSchema,
  date: isoDateSchema,
  slot: timeSlotSchema,
  guestCount: z.number().int().positive().max(5000),
  eventType: eventTypeSchema.default('OTHER'),
  addOnIds: z.array(idSchema).max(20).default([]),
  promoCode: z.string().trim().max(32).optional(),
  note: z.string().max(1000).optional(),
  expectedTotalAmd: amdSchema.optional(),
  /**
   * Repeat of the same key returns the same booking instead of creating a
   * second one — the guard against a double tap on a slow connection.
   */
  idempotencyKey: z.string().min(8).max(64).optional(),
});
export type CreateBookingBody = z.infer<typeof createBookingSchema>;

export const listBookingsQuerySchema = paginationQuerySchema.extend({
  bucket: bookingBucketSchema.default('UPCOMING'),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelBookingBody = z.infer<typeof cancelBookingSchema>;

/** Host-side decision on a PENDING_HOST booking. */
export const hostDecisionSchema = z.object({
  decision: z.enum(['CONFIRM', 'DECLINE']),
  message: z.string().max(500).optional(),
});
export type HostDecisionBody = z.infer<typeof hostDecisionSchema>;

/** Calendar export for the "Add to calendar" button on Booking detail. */
export const calendarLinksSchema = z.object({
  ics: z.string().url(),
  google: z.string().url(),
});
export type CalendarLinks = z.infer<typeof calendarLinksSchema>;

/** Which bucket a status belongs in on My bookings. */
export function bucketForStatus(status: z.infer<typeof bookingStatusSchema>) {
  switch (status) {
    case 'COMPLETED':
      return 'PAST' as const;
    case 'CANCELLED_BY_GUEST':
    case 'CANCELLED_BY_HOST':
    case 'DECLINED':
    case 'EXPIRED':
      return 'CANCELLED' as const;
    default:
      return 'UPCOMING' as const;
  }
}
