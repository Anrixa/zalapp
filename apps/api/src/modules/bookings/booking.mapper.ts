import type {
  Booking,
  BookingAddOn,
  HostProfile,
  User,
  Venue,
  VenueImage,
  VenuePrice,
} from '@prisma/client';
import { computeRefund, type BookingDetail, type BookingSummary, type Quote } from '@zal/contracts';
import { toVenueSummary } from '../venues/venue.mapper';
import { toHostDto } from '../users/user.mapper';
import { toIsoDate, todayInYerevan } from '../../common/utils/dates';

export type BookingWithVenue = Booking & {
  venue: Venue & { images?: VenueImage[]; prices?: VenuePrice[] };
};

export type BookingWithEverything = BookingWithVenue & {
  addOns: BookingAddOn[];
  venue: Venue & {
    images?: VenueImage[];
    prices?: VenuePrice[];
    host: HostProfile & { user?: Pick<User, 'avatarUrl'> | null };
  };
  conversation?: { id: string } | null;
  review?: { id: string } | null;
};

export function toBookingSummary(
  booking: BookingWithVenue,
  options: { isSaved?: boolean } = {},
): BookingSummary {
  return {
    id: booking.id,
    ref: booking.ref,
    status: booking.status,
    eventDate: toIsoDate(booking.eventDate),
    slot: booking.slot,
    guestCount: booking.guestCount,
    eventType: booking.eventType,
    totalAmd: booking.totalAmd,
    paidAmd: booking.paidAmd,
    venue: toVenueSummary(booking.venue, { isSaved: options.isSaved ?? false }),
  };
}

/**
 * Rebuild the stored quote for display.
 *
 * The numbers are read back from the booking rather than recomputed: prices
 * move, and what the guest agreed to is what the screen has to show, even a
 * year later.
 */
export function storedQuote(booking: Booking, addOns: BookingAddOn[]): Quote {
  return {
    rentalAmd: booking.rentalAmd,
    addOnsTotalAmd: booking.addOnsTotalAmd,
    discountAmd: booking.discountAmd,
    subtotalAmd: booking.subtotalAmd,
    serviceFeeAmd: booking.serviceFeeAmd,
    totalAmd: booking.totalAmd,
    depositAmd: booking.depositAmd,
    balanceAmd: booking.balanceAmd,
    serviceFeeRate: booking.subtotalAmd > 0 ? booking.serviceFeeAmd / booking.subtotalAmd : 0,
    depositRate: booking.totalAmd > 0 ? booking.depositAmd / booking.totalAmd : 0,
    lines: [
      { key: 'rental', label: 'Hall rental', amountAmd: booking.rentalAmd },
      ...addOns.map((addOn) => ({
        key: `addon:${addOn.addOnId}`,
        label: addOn.name,
        amountAmd: addOn.priceAmd,
      })),
      ...(booking.discountAmd > 0
        ? [{ key: 'discount', label: 'Discount', amountAmd: -booking.discountAmd }]
        : []),
      { key: 'service_fee', label: 'Service fee', amountAmd: booking.serviceFeeAmd },
    ],
  };
}

const CANCELLABLE = new Set(['AWAITING_DEPOSIT', 'PENDING_HOST', 'CONFIRMED']);

export function toBookingDetail(
  booking: BookingWithEverything,
  options: { isSaved?: boolean } = {},
): BookingDetail {
  const eventDate = toIsoDate(booking.eventDate);

  // Show what cancelling would cost, but only while cancelling is still a thing
  // the guest can do — a preview on a finished booking is just noise.
  const cancellationPreview = CANCELLABLE.has(booking.status)
    ? computeRefund({
        eventDate,
        paidAmd: booking.paidAmd,
        depositAmd: booking.depositAmd,
        onDate: todayInYerevan(),
      })
    : null;

  return {
    ...toBookingSummary(booking, options),
    addOns: booking.addOns.map((addOn) => ({
      id: addOn.id,
      addOnId: addOn.addOnId,
      name: addOn.name,
      priceAmd: addOn.priceAmd,
    })),
    quote: storedQuote(booking, booking.addOns),
    depositAmd: booking.depositAmd,
    balanceAmd: booking.balanceAmd,
    balanceDueOn: toIsoDate(booking.balanceDueOn),
    freeCancellationUntil: toIsoDate(booking.freeCancellationUntil),
    cancellationPreview,
    host: toHostDto(booking.venue.host, { venueCount: 0, ratingAvg: booking.venue.ratingAvg }),
    note: booking.note,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    conversationId: booking.conversation?.id ?? null,
    hasReview: Boolean(booking.review),
  };
}
