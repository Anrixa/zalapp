import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  BookingStatus,
  ErrorCode,
  RealtimeEvent,
  SLOT_HOURS,
  computeDeadlines,
  computeQuote,
  computeRefund,
  formatBookingRef,
  type BookingDetail,
  type BookingSummary,
  type CalendarLinks,
  type CancelBookingBody,
  type CreateBookingBody,
  type HostDecisionBody,
  type ListBookingsQuery,
  type Page,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { fromIsoDate, toIsoDate, todayInYerevan } from '../../common/utils/dates';
import { AvailabilityService } from '../venues/availability.service';
import { VenuesService } from '../venues/venues.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { loadEnv } from '../../config/env';
import { toBookingDetail, toBookingSummary, type BookingWithEverything } from './booking.mapper';

const DETAIL_INCLUDE = {
  addOns: true,
  conversation: { select: { id: true } },
  venue: {
    include: {
      images: { orderBy: { position: 'asc' } },
      prices: true,
      host: { include: { user: { select: { avatarUrl: true } } } },
    },
  },
} satisfies Prisma.BookingInclude;

const BUCKET_STATUSES = {
  UPCOMING: [BookingStatus.AWAITING_DEPOSIT, BookingStatus.PENDING_HOST, BookingStatus.CONFIRMED],
  PAST: [BookingStatus.COMPLETED],
  CANCELLED: [
    BookingStatus.CANCELLED_BY_GUEST,
    BookingStatus.CANCELLED_BY_HOST,
    BookingStatus.DECLINED,
    BookingStatus.EXPIRED,
  ],
} as const;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenuesService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Create a booking.
   *
   * Everything that decides money or availability is resolved here, server
   * side: the rental price for that exact date, the add-ons as they exist now,
   * the promo, the quote. The body says what the guest chose, never what it
   * costs, so a tampered request changes nothing but its own rejection.
   *
   * The whole thing runs in one transaction, and the unique index on
   * (venueId, date, slot) is what makes two simultaneous bookings of the same
   * Saturday evening impossible rather than merely unlikely.
   */
  async create(userId: string, body: CreateBookingBody): Promise<BookingDetail> {
    if (body.idempotencyKey) {
      const replay = await this.prisma.idempotencyRecord.findUnique({
        where: { key: body.idempotencyKey },
      });
      if (replay && replay.userId === userId && replay.scope === 'booking.create') {
        return this.detail(userId, replay.resultId);
      }
    }

    const venue = await this.prisma.venue.findFirst({
      where: { id: body.venueId, deletedAt: null, status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        capacityMax: true,
        depositRate: true,
        hostProfileId: true,
        host: { select: { userId: true, displayName: true } },
      },
    });
    if (!venue) throw AppError.notFound('Venue');

    if (body.date < todayInYerevan()) {
      throw new AppError(ErrorCode.SLOT_IN_THE_PAST, 'Pick a date in the future');
    }
    if (body.guestCount > venue.capacityMax) {
      throw new AppError(
        ErrorCode.OVER_CAPACITY,
        `This hall fits up to ${venue.capacityMax} guests`,
      );
    }

    const [rentalAmd, addOns, promo] = await Promise.all([
      this.availability.resolvePrice(venue.id, body.date, body.slot),
      this.venues.loadAddOns(venue.id, body.addOnIds),
      this.venues.resolvePromo(body.promoCode),
    ]);

    const quote = computeQuote({
      rentalAmd,
      addOns: addOns.map((addOn) => ({
        id: addOn.id,
        name: addOn.name,
        priceAmd: addOn.priceAmd,
      })),
      discountAmd: promo?.discountAmd ?? 0,
      ...(promo?.label ? { discountLabel: promo.label } : {}),
    });

    // The client may state the total it showed the guest. If it no longer
    // matches, the price moved while the Checkout screen was open — better a
    // clear rejection than a surprise on the card statement.
    if (body.expectedTotalAmd !== undefined && body.expectedTotalAmd !== quote.totalAmd) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'The price changed while you were booking — check the new total and try again',
      );
    }

    const deadlines = computeDeadlines(body.date);

    const booking = await this.prisma.$transaction(async (tx) => {
      // Sequence within the day, so refs read ZAL-20260926-01, -02, …
      const sameDay = await tx.booking.count({ where: { eventDate: fromIsoDate(body.date) } });

      const created = await tx.booking.create({
        data: {
          ref: formatBookingRef(body.date, sameDay + 1),
          venueId: venue.id,
          userId,
          status: BookingStatus.AWAITING_DEPOSIT,
          eventDate: fromIsoDate(body.date),
          slot: body.slot,
          guestCount: body.guestCount,
          eventType: body.eventType,
          note: body.note ?? null,
          rentalAmd: quote.rentalAmd,
          addOnsTotalAmd: quote.addOnsTotalAmd,
          discountAmd: quote.discountAmd,
          subtotalAmd: quote.subtotalAmd,
          serviceFeeAmd: quote.serviceFeeAmd,
          totalAmd: quote.totalAmd,
          depositAmd: quote.depositAmd,
          balanceAmd: quote.balanceAmd,
          balanceDueOn: fromIsoDate(deadlines.balanceDueOn),
          freeCancellationUntil: fromIsoDate(deadlines.freeCancellationUntil),
          promoCode: promo?.code ?? null,
          addOns: {
            create: addOns.map((addOn) => ({
              addOnId: addOn.id,
              name: addOn.name,
              priceAmd: addOn.priceAmd,
            })),
          },
        },
      });

      await this.availability.hold(tx, {
        venueId: venue.id,
        date: body.date,
        slot: body.slot,
        bookingId: created.id,
        priceAmd: quote.rentalAmd,
      });

      if (promo) {
        await tx.promoCode.update({
          where: { id: promo.id },
          data: { redemptions: { increment: 1 } },
        });
      }

      if (body.idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: body.idempotencyKey,
            userId,
            scope: 'booking.create',
            resultId: created.id,
          },
        });
      }

      return created;
    });

    this.logger.log(`Booking ${booking.ref} held for user ${userId} at ${venue.name}`);
    return this.detail(userId, booking.id);
  }

  async list(userId: string, query: ListBookingsQuery): Promise<Page<BookingSummary>> {
    const cursorId = decodeCursor(query.cursor);

    // "Upcoming" is about the date, not only the status: a confirmed booking
    // whose day has passed belongs under Past even before the nightly job has
    // marked it completed.
    const today = fromIsoDate(todayInYerevan());
    const where: Prisma.BookingWhereInput = {
      userId,
      status: { in: [...BUCKET_STATUSES[query.bucket]] },
      ...(query.bucket === 'UPCOMING' ? { eventDate: { gte: today } } : {}),
      ...(query.bucket === 'PAST' ? { eventDate: { lt: today } } : {}),
    };

    if (query.bucket === 'PAST') {
      where.status = {
        in: [BookingStatus.COMPLETED, BookingStatus.CONFIRMED],
      };
    }

    const rows = await this.prisma.booking.findMany({
      where,
      include: { venue: { include: { images: { orderBy: { position: 'asc' } }, prices: true } } },
      orderBy:
        query.bucket === 'UPCOMING'
          ? [{ eventDate: 'asc' }, { id: 'asc' }]
          : [{ eventDate: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.id);
    return { items: items.map((row) => toBookingSummary(row)), nextCursor };
  }

  async detail(userId: string, bookingId: string): Promise<BookingDetail> {
    const booking = (await this.prisma.booking.findFirst({
      where: { id: bookingId },
      include: DETAIL_INCLUDE,
    })) as BookingWithEverything | null;

    if (!booking) throw AppError.notFound('Booking');
    await this.assertParticipant(booking, userId);

    return toBookingDetail(booking);
  }

  /**
   * Cancel.
   *
   * The refund follows the published policy exactly — free until 14 days
   * before, deposit forfeit after that — and the date goes straight back on the
   * calendar, because a held date nobody can book helps no one.
   */
  async cancel(userId: string, bookingId: string, body: CancelBookingBody) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { venue: { select: { id: true, name: true, host: { select: { userId: true } } } } },
    });
    if (!booking) throw AppError.notFound('Booking');

    if (
      ![
        BookingStatus.AWAITING_DEPOSIT,
        BookingStatus.PENDING_HOST,
        BookingStatus.CONFIRMED,
      ].includes(booking.status as never)
    ) {
      throw new AppError(
        ErrorCode.BOOKING_NOT_CANCELLABLE,
        'This booking can no longer be cancelled — contact the host',
      );
    }

    const eventDate = toIsoDate(booking.eventDate);
    const refund = computeRefund({
      eventDate,
      paidAmd: booking.paidAmd,
      depositAmd: booking.depositAmd,
      onDate: todayInYerevan(),
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED_BY_GUEST,
          cancelledAt: new Date(),
          cancelReason: body.reason ?? null,
          refundedAmd: refund.refundAmd,
        },
      });

      await this.availability.release(tx, {
        venueId: booking.venueId,
        date: eventDate,
        slot: booking.slot,
        bookingId: booking.id,
      });

      if (refund.refundAmd > 0) {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            kind: 'REFUND',
            provider: 'CARD',
            status: 'PENDING',
            amountAmd: -refund.refundAmd,
          },
        });
      }
    });

    this.realtime.emitToUser(userId, RealtimeEvent.BOOKING_UPDATED, {
      bookingId: booking.id,
      status: BookingStatus.CANCELLED_BY_GUEST,
      venueId: booking.venueId,
    });

    await this.notifications.create({
      userId: booking.venue.host.userId,
      type: 'BOOKING_CANCELLED',
      title: 'Booking cancelled',
      body: `${booking.ref} at ${booking.venue.name} was cancelled by the guest.`,
      data: { bookingId: booking.id, venueId: booking.venueId },
    });

    return { booking: await this.detail(userId, booking.id), refund };
  }

  /** The host accepts or declines a booking waiting on them. */
  async decide(hostUserId: string, bookingId: string, body: HostDecisionBody) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId },
      include: { venue: { select: { id: true, name: true, host: { select: { userId: true } } } } },
    });
    if (!booking) throw AppError.notFound('Booking');

    if (booking.venue.host.userId !== hostUserId) {
      throw AppError.forbidden('Only the venue host can decide on this booking');
    }
    if (booking.status !== BookingStatus.PENDING_HOST) {
      throw new AppError(ErrorCode.CONFLICT, 'This booking is not waiting on a decision any more');
    }

    const eventDate = toIsoDate(booking.eventDate);
    const confirmed = body.decision === 'CONFIRM';

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: confirmed
          ? { status: BookingStatus.CONFIRMED, confirmedAt: new Date() }
          : {
              status: BookingStatus.DECLINED,
              cancelledAt: new Date(),
              cancelReason: body.message ?? null,
              // A declined booking is nobody's fault but the host's, so the
              // guest gets every dram back regardless of the cancellation window.
              refundedAmd: booking.paidAmd,
            },
      });

      if (confirmed) {
        await this.availability.markBooked(tx, {
          venueId: booking.venueId,
          date: eventDate,
          slot: booking.slot,
          bookingId: booking.id,
        });
      } else {
        await this.availability.release(tx, {
          venueId: booking.venueId,
          date: eventDate,
          slot: booking.slot,
          bookingId: booking.id,
        });
        if (booking.paidAmd > 0) {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              kind: 'REFUND',
              provider: 'CARD',
              status: 'PENDING',
              amountAmd: -booking.paidAmd,
            },
          });
        }
      }
    });

    this.realtime.emitToUser(booking.userId, RealtimeEvent.BOOKING_UPDATED, {
      bookingId: booking.id,
      status: confirmed ? BookingStatus.CONFIRMED : BookingStatus.DECLINED,
      venueId: booking.venueId,
    });

    await this.notifications.create({
      userId: booking.userId,
      type: confirmed ? 'BOOKING_CONFIRMED' : 'BOOKING_DECLINED',
      title: confirmed ? 'Booking confirmed' : 'Booking declined',
      body: confirmed
        ? `Your date at ${booking.venue.name} is locked in.`
        : `${booking.venue.name} could not take that date. Your deposit is on its way back.`,
      data: { bookingId: booking.id, venueId: booking.venueId },
    });

    return this.detail(booking.userId, booking.id);
  }

  /**
   * Calendar links for "Add to calendar".
   *
   * The .ics is served by the API so a phone can subscribe to it, and the
   * Google link is a plain URL — between them they cover every calendar app a
   * guest in Armenia is likely to use.
   */
  async calendarLinks(userId: string, bookingId: string): Promise<CalendarLinks> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { venue: { select: { name: true, addressLine: true, district: true, city: true } } },
    });
    if (!booking) throw AppError.notFound('Booking');

    const date = toIsoDate(booking.eventDate).replaceAll('-', '');
    const hours = SLOT_HOURS[booking.slot];
    const start = `${date}T${hours.start.replace(':', '')}00`;
    const end = `${date}T${hours.end.replace(':', '')}00`;
    const location = `${booking.venue.addressLine}, ${booking.venue.district}, ${booking.venue.city}`;

    const google = new URL('https://calendar.google.com/calendar/render');
    google.searchParams.set('action', 'TEMPLATE');
    google.searchParams.set('text', `${booking.venue.name} — Zal booking ${booking.ref}`);
    google.searchParams.set('dates', `${start}/${end}`);
    google.searchParams.set('location', location);
    google.searchParams.set('details', `Booking reference ${booking.ref}`);

    return {
      ics: `${this.env.API_PUBLIC_URL}/${this.env.API_GLOBAL_PREFIX}/v1/bookings/${booking.id}/calendar.ics`,
      google: google.toString(),
    };
  }

  async icsFor(userId: string, bookingId: string): Promise<string> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { venue: { select: { name: true, addressLine: true, district: true, city: true } } },
    });
    if (!booking) throw AppError.notFound('Booking');

    const date = toIsoDate(booking.eventDate).replaceAll('-', '');
    const hours = SLOT_HOURS[booking.slot];
    const location = `${booking.venue.addressLine}, ${booking.venue.district}, ${booking.venue.city}`;

    // Times are local to the venue; Armenia has had no daylight saving since
    // 2012, so a fixed +04:00 offset is correct rather than merely convenient.
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zal//Booking//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${booking.id}@zal.am`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;TZID=Asia/Yerevan:${date}T${hours.start.replace(':', '')}00`,
      `DTEND;TZID=Asia/Yerevan:${date}T${hours.end.replace(':', '')}00`,
      `SUMMARY:${booking.venue.name} — Zal ${booking.ref}`,
      `LOCATION:${location}`,
      `DESCRIPTION:Booking reference ${booking.ref}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * Nightly sweep: yesterday's confirmed bookings become completed, which is
   * what unlocks reviewing them.
   */
  async completePastBookings(): Promise<number> {
    const { count } = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.CONFIRMED,
        eventDate: { lt: fromIsoDate(todayInYerevan()) },
      },
      data: { status: BookingStatus.COMPLETED },
    });
    if (count > 0) this.logger.log(`Marked ${count} booking(s) completed`);
    return count;
  }

  private async assertParticipant(
    booking: { userId: string; venueId: string },
    userId: string,
  ): Promise<void> {
    if (booking.userId === userId) return;

    const isHost = await this.prisma.venue.findFirst({
      where: { id: booking.venueId, host: { userId } },
      select: { id: true },
    });
    if (!isHost) throw AppError.forbidden();
  }
}
