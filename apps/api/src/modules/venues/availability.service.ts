import { Injectable } from '@nestjs/common';
import type { Prisma, TimeSlot } from '@prisma/client';
import {
  AvailabilityStatus,
  ErrorCode,
  TimeSlot as TimeSlotEnum,
  type AvailabilityResponse,
  type DayAvailability,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import {
  eachDate,
  fromIsoDate,
  isWeekend,
  toIsoDate,
  todayInYerevan,
} from '../../common/utils/dates';

const ALL_SLOTS: TimeSlot[] = [TimeSlotEnum.AFTERNOON, TimeSlotEnum.EVENING];

/**
 * Availability.
 *
 * The calendar is stored sparsely: a row exists only for a date/slot that
 * differs from the default. Absence means "open at the standard price", so a
 * venue that has just been listed is bookable immediately instead of appearing
 * fully booked until someone fills in a year of rows.
 *
 * That inversion is also what makes the month view cheap — one indexed query
 * per month returns only the exceptions, and the rest is computed.
 */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async forRange(venueId: string, from: string, to: string): Promise<AvailabilityResponse> {
    const dates = eachDate(from, to);
    if (dates.length === 0 || dates.length > 400) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Ask for a range of up to about a year');
    }

    const [prices, exceptions] = await Promise.all([
      this.prisma.venuePrice.findMany({ where: { venueId } }),
      this.prisma.venueAvailability.findMany({
        where: { venueId, date: { gte: fromIsoDate(from), lte: fromIsoDate(to) } },
      }),
    ]);

    const priceBySlot = new Map(prices.map((price) => [price.slot, price]));
    const exceptionKey = (date: string, slot: TimeSlot) => `${date}:${slot}`;
    const exceptionMap = new Map(
      exceptions.map((row) => [exceptionKey(toIsoDate(row.date), row.slot), row]),
    );

    const today = todayInYerevan();

    const days: DayAvailability[] = dates.map((date) => {
      const slots = ALL_SLOTS.map((slot) => {
        const exception = exceptionMap.get(exceptionKey(date, slot));
        const base = priceBySlot.get(slot);

        const standardPrice =
          (isWeekend(date) ? (base?.weekendPriceAmd ?? base?.priceAmd) : base?.priceAmd) ?? 0;

        // A date in the past is not "open" however empty the calendar is.
        const status =
          date < today
            ? AvailabilityStatus.BLOCKED
            : (exception?.status ?? AvailabilityStatus.OPEN);

        return {
          slot,
          status,
          priceAmd: exception?.priceAmd ?? standardPrice,
        };
      });

      return {
        date,
        slots,
        fullyBooked: slots.every((slot) => slot.status !== AvailabilityStatus.OPEN),
      };
    });

    return { venueId, days };
  }

  /** The price actually charged for one date and slot, overrides included. */
  async resolvePrice(venueId: string, date: string, slot: TimeSlot): Promise<number> {
    const [base, exception] = await Promise.all([
      this.prisma.venuePrice.findUnique({ where: { venueId_slot: { venueId, slot } } }),
      this.prisma.venueAvailability.findUnique({
        where: { venueId_date_slot: { venueId, date: fromIsoDate(date), slot } },
      }),
    ]);

    if (exception?.priceAmd != null) return exception.priceAmd;
    if (!base) {
      throw new AppError(ErrorCode.NOT_FOUND, 'That venue has no price set for this time slot');
    }
    return isWeekend(date) ? (base.weekendPriceAmd ?? base.priceAmd) : base.priceAmd;
  }

  async isOpen(venueId: string, date: string, slot: TimeSlot): Promise<boolean> {
    if (date < todayInYerevan()) return false;

    const exception = await this.prisma.venueAvailability.findUnique({
      where: { venueId_date_slot: { venueId, date: fromIsoDate(date), slot } },
      select: { status: true },
    });

    return !exception || exception.status === AvailabilityStatus.OPEN;
  }

  /**
   * Take a slot, inside the caller's transaction.
   *
   * The unique index on (venueId, date, slot) is what actually prevents a
   * double booking: two concurrent requests both see an open slot, both try to
   * write the row, and exactly one succeeds. The check above is a courtesy for
   * the UI; this is the guarantee.
   */
  async hold(
    tx: Prisma.TransactionClient,
    params: { venueId: string; date: string; slot: TimeSlot; bookingId: string; priceAmd: number },
  ): Promise<void> {
    const { venueId, date, slot, bookingId } = params;

    const existing = await tx.venueAvailability.findUnique({
      where: { venueId_date_slot: { venueId, date: fromIsoDate(date), slot } },
    });

    if (existing && existing.status !== AvailabilityStatus.OPEN) {
      throw new AppError(
        ErrorCode.SLOT_UNAVAILABLE,
        'That date has just been taken — pick another one',
      );
    }

    if (existing) {
      await tx.venueAvailability.update({
        where: { id: existing.id },
        data: { status: AvailabilityStatus.HELD, bookingId },
      });
      return;
    }

    try {
      await tx.venueAvailability.create({
        data: {
          venueId,
          date: fromIsoDate(date),
          slot,
          status: AvailabilityStatus.HELD,
          bookingId,
        },
      });
    } catch {
      // Unique violation: somebody else won the race in the moment between the
      // read above and this write.
      throw new AppError(
        ErrorCode.SLOT_UNAVAILABLE,
        'That date has just been taken — pick another one',
      );
    }
  }

  async markBooked(
    tx: Prisma.TransactionClient,
    params: { venueId: string; date: string; slot: TimeSlot; bookingId: string },
  ): Promise<void> {
    await tx.venueAvailability.updateMany({
      where: {
        venueId: params.venueId,
        date: fromIsoDate(params.date),
        slot: params.slot,
        bookingId: params.bookingId,
      },
      data: { status: AvailabilityStatus.BOOKED },
    });
  }

  /** Give the date back to the calendar when a booking falls through. */
  async release(
    tx: Prisma.TransactionClient,
    params: { venueId: string; date: string; slot: TimeSlot; bookingId: string },
  ): Promise<void> {
    await tx.venueAvailability.updateMany({
      where: {
        venueId: params.venueId,
        date: fromIsoDate(params.date),
        slot: params.slot,
        bookingId: params.bookingId,
      },
      data: { status: AvailabilityStatus.OPEN, bookingId: null },
    });
  }
}
