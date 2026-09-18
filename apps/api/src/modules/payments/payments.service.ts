import { Injectable, Logger } from '@nestjs/common';
import type { Payment as PaymentRow } from '@prisma/client';
import {
  BookingStatus,
  ErrorCode,
  RealtimeEvent,
  formatAmdPlain,
  type CreatePaymentIntentBody,
  type Payment,
  type PaymentIntent,
  type PaymentStatusResponse,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PaymentProviderService } from './payment-provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PaymentProviderService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Start a payment.
   *
   * The amount is taken from the booking, never from the request: the client
   * says *which* slice it is paying (deposit or balance), and the server decides
   * what that slice costs.
   */
  async createIntent(userId: string, body: CreatePaymentIntentBody): Promise<PaymentIntent> {
    if (body.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (existing) return this.handoffFor(existing, null);
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: body.bookingId, userId },
      include: { venue: { select: { name: true, host: { select: { userId: true } } } } },
    });
    if (!booking) throw AppError.notFound('Booking');

    if (
      [
        BookingStatus.CANCELLED_BY_GUEST,
        BookingStatus.CANCELLED_BY_HOST,
        BookingStatus.DECLINED,
        BookingStatus.EXPIRED,
      ].includes(booking.status as never)
    ) {
      throw new AppError(ErrorCode.CONFLICT, 'This booking is no longer active');
    }

    const amountAmd = body.kind === 'DEPOSIT' ? booking.depositAmd : booking.balanceAmd;
    const alreadyPaid = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        kind: body.kind,
        status: { in: ['SUCCEEDED', 'PROCESSING'] },
      },
      select: { id: true },
    });
    if (alreadyPaid) {
      throw new AppError(
        ErrorCode.PAYMENT_ALREADY_SETTLED,
        body.kind === 'DEPOSIT'
          ? 'The deposit for this booking is already paid'
          : 'The balance for this booking is already paid',
      );
    }
    if (amountAmd <= 0) {
      throw new AppError(ErrorCode.CONFLICT, 'There is nothing left to pay on this booking');
    }

    const savedMethod = body.savedMethodId
      ? await this.prisma.paymentMethod.findFirst({
          where: { id: body.savedMethodId, userId, deletedAt: null },
        })
      : null;
    if (body.savedMethodId && !savedMethod) throw AppError.notFound('Payment method');

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        paymentMethodId: savedMethod?.id ?? null,
        kind: body.kind,
        provider: body.provider,
        status: 'PENDING',
        amountAmd,
        idempotencyKey: body.idempotencyKey ?? null,
      },
    });

    const handoff = await this.provider.charge({
      paymentId: payment.id,
      bookingRef: booking.ref,
      amountAmd,
      provider: body.provider,
      savedProviderToken: savedMethod?.providerToken ?? null,
      ...(body.returnUrl ? { returnUrl: body.returnUrl } : {}),
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: handoff.providerRef, status: 'PROCESSING' },
    });

    if (handoff.settledImmediately) {
      await this.settle(updated.id, true);
      const settled = await this.prisma.payment.findUniqueOrThrow({ where: { id: updated.id } });
      return this.handoffFor(settled, handoff);
    }

    return this.handoffFor(updated, handoff);
  }

  async status(userId: string, paymentId: string): Promise<PaymentStatusResponse> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, booking: { userId } },
      include: { booking: { select: { status: true } } },
    });
    if (!payment) throw AppError.notFound('Payment');

    return { payment: toPaymentDto(payment), bookingStatus: payment.booking.status };
  }

  /**
   * Settle a payment and move the booking on.
   *
   * Idempotent by design: providers retry webhooks, and a second delivery of
   * the same success must not add the amount to `paidAmd` twice.
   */
  async settle(paymentId: string, succeeded: boolean, failureCode?: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { venue: { select: { name: true, host: { select: { userId: true } } } } },
        },
      },
    });
    if (!payment) throw AppError.notFound('Payment');

    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      this.logger.debug(`Payment ${paymentId} already settled as ${payment.status}; ignoring`);
      return;
    }

    const booking = payment.booking;

    if (!succeeded) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureCode: failureCode ?? 'declined' },
      });
      this.realtime.emitToUser(booking.userId, RealtimeEvent.PAYMENT_UPDATED, {
        paymentId: payment.id,
        bookingId: booking.id,
        status: 'FAILED',
      });
      return;
    }

    const nextStatus =
      payment.kind === 'DEPOSIT' && booking.status === BookingStatus.AWAITING_DEPOSIT
        ? BookingStatus.PENDING_HOST
        : booking.status;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', settledAt: new Date() },
      }),
      this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          paidAmd: { increment: payment.amountAmd },
          ...(nextStatus !== booking.status ? { status: nextStatus } : {}),
        },
      }),
    ]);

    this.realtime.emitToUser(booking.userId, RealtimeEvent.PAYMENT_UPDATED, {
      paymentId: payment.id,
      bookingId: booking.id,
      status: 'SUCCEEDED',
    });
    if (nextStatus !== booking.status) {
      this.realtime.emitToUser(booking.userId, RealtimeEvent.BOOKING_UPDATED, {
        bookingId: booking.id,
        status: nextStatus,
        venueId: booking.venueId,
      });
    }

    await this.notifications.create({
      userId: booking.userId,
      type: 'PAYMENT_RECEIVED',
      title: payment.kind === 'DEPOSIT' ? 'Deposit received' : 'Balance received',
      body: `${formatAmdPlain(payment.amountAmd)} received for ${booking.venue.name}.`,
      data: { bookingId: booking.id, amountAmd: payment.amountAmd },
      // The guest just pressed Pay; a push telling them so is noise.
      silent: true,
    });

    if (payment.kind === 'DEPOSIT') {
      await this.notifications.create({
        userId: booking.venue.host.userId,
        type: 'BOOKING_CONFIRMED',
        title: 'New booking request',
        body: `${booking.ref} — deposit paid, waiting on your confirmation.`,
        data: { bookingId: booking.id },
      });
    }
  }

  /** Called by the provider webhook once it knows the outcome. */
  async handleWebhook(
    provider: string,
    headers: Record<string, unknown>,
    rawBody: string,
    payload: { paymentId?: string; providerRef?: string; status?: string; failureCode?: string },
  ): Promise<{ ok: true }> {
    if (!this.provider.verifyWebhook(provider, headers, rawBody)) {
      throw AppError.forbidden('Webhook signature did not verify');
    }

    const payment = payload.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: payload.paymentId } })
      : payload.providerRef
        ? await this.prisma.payment.findFirst({ where: { providerRef: payload.providerRef } })
        : null;

    if (!payment) throw AppError.notFound('Payment');

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerPayload: JSON.parse(rawBody || '{}') },
    });

    await this.settle(payment.id, payload.status === 'succeeded', payload.failureCode ?? undefined);
    return { ok: true };
  }

  private handoffFor(
    payment: PaymentRow,
    handoff: {
      redirectUrl: string | null;
      clientSecret: string | null;
      bankTransfer: PaymentIntent['bankTransfer'];
    } | null,
  ): PaymentIntent {
    return {
      paymentId: payment.id,
      status: payment.status,
      amountAmd: Math.abs(payment.amountAmd),
      provider: payment.provider,
      redirectUrl: handoff?.redirectUrl ?? null,
      clientSecret: handoff?.clientSecret ?? null,
      bankTransfer: handoff?.bankTransfer ?? null,
    };
  }
}

export function toPaymentDto(payment: PaymentRow): Payment {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    kind: payment.kind,
    provider: payment.provider,
    status: payment.status,
    amountAmd: payment.amountAmd,
    providerRef: payment.providerRef,
    failureCode: payment.failureCode,
    createdAt: payment.createdAt.toISOString(),
    settledAt: payment.settledAt?.toISOString() ?? null,
  };
}
