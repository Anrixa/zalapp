import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingStatus, NotificationType } from '@prisma/client';
import { formatAmdPlain } from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fromIsoDate, toIsoDate, todayInYerevan } from '../../common/utils/dates';
import { NotificationsService } from '../notifications/notifications.service';
import { TokenService } from '../auth/token.service';
import { loadEnv } from '../../config/env';
import { balanceReminderWindow, holdCutoff } from './schedule-math';

/**
 * Scheduled work.
 *
 * Four jobs, all of them idempotent, because a cron that cannot safely run
 * twice is a cron that will eventually corrupt something. Times are expressed
 * in Asia/Yerevan: "the day after the event" has to mean the venue's day, not
 * the server's.
 *
 * `ENABLE_SCHEDULER=false` turns the jobs off for a process. Running two API
 * instances with the scheduler on in both would send every reminder twice, so
 * in a multi-instance deployment exactly one process should have it enabled.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly tokens: TokenService,
  ) {}

  private get enabled(): boolean {
    return this.env.ENABLE_SCHEDULER;
  }

  /**
   * Yesterday's confirmed bookings become completed, which is what unlocks
   * reviewing them and moves them to the Past tab.
   */
  @Cron('15 0 * * *', { name: 'complete-past-bookings', timeZone: 'Asia/Yerevan' })
  async completePastBookings(): Promise<number> {
    if (!this.enabled) return 0;

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

  /**
   * Remind guests whose balance is nearly due.
   *
   * The `notification already sent` check is what makes this safe to run twice:
   * a retry, a restart, or a second instance briefly enabled all find the
   * existing row and send nothing. It is also what lets the query sweep a
   * window rather than a single date, so a run missed over a deploy is picked
   * up by the next one instead of losing that day's guests.
   */
  @Cron('0 10 * * *', { name: 'balance-reminders', timeZone: 'Asia/Yerevan' })
  async sendBalanceReminders(): Promise<number> {
    if (!this.enabled) return 0;

    const window = balanceReminderWindow(todayInYerevan());

    const due = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        balanceDueOn: { gte: fromIsoDate(window.from), lte: fromIsoDate(window.to) },
      },
      include: { venue: { select: { id: true, name: true } } },
    });

    let sent = 0;

    for (const booking of due) {
      const outstanding = booking.totalAmd - booking.paidAmd;
      if (outstanding <= 0) continue;

      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          userId: booking.userId,
          type: NotificationType.BALANCE_DUE,
          data: { path: ['bookingId'], equals: booking.id },
        },
        select: { id: true },
      });
      if (alreadySent) continue;

      await this.notifications.create({
        userId: booking.userId,
        type: NotificationType.BALANCE_DUE,
        title: 'Balance due soon',
        body: `Balance of ${formatAmdPlain(outstanding)} for ${booking.venue.name} is due on ${toIsoDate(
          booking.balanceDueOn,
        )}.`,
        data: { bookingId: booking.id, venueId: booking.venue.id, amountAmd: outstanding },
      });
      sent += 1;
    }

    if (sent > 0) this.logger.log(`Sent ${sent} balance reminder(s) due by ${window.to}`);
    return sent;
  }

  /**
   * Drop refresh tokens that can no longer authenticate anything.
   *
   * Housekeeping rather than security — an expired token is already refused —
   * but the table grows by one row per refresh per device and nothing else ever
   * removes them.
   */
  @Cron('30 3 * * 0', { name: 'prune-expired-tokens', timeZone: 'Asia/Yerevan' })
  async pruneExpiredTokens(): Promise<number> {
    if (!this.enabled) return 0;

    const count = await this.tokens.pruneExpired();
    if (count > 0) this.logger.log(`Pruned ${count} expired refresh token(s)`);
    return count;
  }

  /**
   * Release dates held by a booking whose deposit never arrived.
   *
   * Without this a guest who opens Checkout and walks away holds a Saturday
   * indefinitely, which is invisible to everyone and costs the host a booking.
   */
  @Cron('*/30 * * * *', { name: 'expire-unpaid-holds', timeZone: 'Asia/Yerevan' })
  async expireUnpaidHolds(): Promise<number> {
    if (!this.enabled) return 0;

    const cutoff = holdCutoff(new Date(), this.env.BOOKING_HOLD_MINUTES);

    const stale = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.AWAITING_DEPOSIT,
        paidAmd: 0,
        createdAt: { lt: cutoff },
      },
      select: { id: true, venueId: true, eventDate: true, slot: true },
    });

    let released = 0;

    for (const booking of stale) {
      /**
       * The read above and this write are minutes apart on a long list, and a
       * deposit can settle in between. So the conditions that selected the
       * booking are re-asserted here as part of the write: if the payment
       * webhook has already moved it to PENDING_HOST, `count` is 0, the date
       * stays held, and the guest keeps the Saturday they just paid for.
       *
       * Expressed as `updateMany` rather than `update` precisely because it
       * takes a `where` beyond the id and reports how many rows matched.
       */
      const expired = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.AWAITING_DEPOSIT,
            paidAmd: 0,
          },
          data: { status: BookingStatus.EXPIRED, cancelledAt: new Date() },
        });

        if (count === 0) return false;

        await tx.venueAvailability.updateMany({
          where: {
            venueId: booking.venueId,
            date: booking.eventDate,
            slot: booking.slot,
            bookingId: booking.id,
          },
          data: { status: 'OPEN', bookingId: null },
        });

        return true;
      });

      if (expired) released += 1;
    }

    if (released > 0) this.logger.log(`Released ${released} unpaid hold(s)`);
    return released;
  }
}
