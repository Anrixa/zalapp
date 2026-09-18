import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PaymentProvider as Provider } from '@prisma/client';
import { loadEnv } from '../../config/env';

export interface ChargeRequest {
  paymentId: string;
  bookingRef: string;
  amountAmd: number;
  provider: Provider;
  savedProviderToken?: string | null;
  returnUrl?: string;
}

export interface ChargeHandoff {
  providerRef: string;
  /** Send the guest here (3-D Secure, Idram, Telcell). */
  redirectUrl: string | null;
  /** Hand to a provider SDK that collects the card in-app. */
  clientSecret: string | null;
  bankTransfer: {
    beneficiary: string;
    iban: string;
    bank: string;
    reference: string;
    note: string;
  } | null;
  /** True when the money is already known to have moved — only the mock does this. */
  settledImmediately: boolean;
}

/**
 * Payment providers.
 *
 * Every rail in the design — ArCa/Visa/Mastercard, Idram, Telcell, bank
 * transfer — reduces to the same two moments: hand the guest off, then hear
 * back. Modelling it that way means the booking state machine is written once
 * and a new acquirer is a new branch here rather than a new flow through
 * BookingsService.
 *
 * `PAYMENTS_PROVIDER=mock` settles instantly so the whole booking flow can be
 * exercised end to end in development without a merchant account.
 */
@Injectable()
export class PaymentProviderService {
  private readonly logger = new Logger(PaymentProviderService.name);
  private readonly env = loadEnv();

  async charge(request: ChargeRequest): Promise<ChargeHandoff> {
    if (request.provider === 'BANK_TRANSFER') {
      return {
        providerRef: `BT-${request.bookingRef}`,
        redirectUrl: null,
        clientSecret: null,
        bankTransfer: {
          beneficiary: 'Zal LLC',
          iban: 'AM00 0000 0000 0000 0000 0000',
          bank: 'Ameriabank',
          reference: request.bookingRef,
          note: 'Your booking is held for 48 hours. Send the reference with the transfer so we can match it.',
        },
        settledImmediately: false,
      };
    }

    if (this.env.PAYMENTS_PROVIDER === 'mock') {
      this.logger.debug(
        `mock charge ${request.amountAmd} AMD for ${request.bookingRef} via ${request.provider}`,
      );
      return {
        providerRef: `mock_${randomUUID()}`,
        redirectUrl: null,
        clientSecret: `mock_secret_${request.paymentId}`,
        bankTransfer: null,
        settledImmediately: true,
      };
    }

    // Real acquirers are wired per environment. Throwing rather than silently
    // pretending keeps a misconfigured production deploy from taking bookings
    // it never charges for.
    throw new Error(
      `PAYMENTS_PROVIDER=${this.env.PAYMENTS_PROVIDER} has no adapter wired for ${request.provider}`,
    );
  }

  /**
   * Check a webhook actually came from the provider.
   *
   * Left strict on purpose: an unverified webhook is a way to mark any booking
   * paid, so the mock accepts only a shared-secret header and the real adapters
   * must implement their provider's signature scheme before they are switched on.
   */
  verifyWebhook(provider: string, headers: Record<string, unknown>, _rawBody: string): boolean {
    if (this.env.PAYMENTS_PROVIDER === 'mock') {
      return headers['x-zal-mock-signature'] === 'mock';
    }
    this.logger.warn(`No webhook verifier wired for provider ${provider}`);
    return false;
  }

  /** Refunds follow the same shape: request now, confirm on the webhook. */
  async refund(providerRef: string, amountAmd: number): Promise<{ providerRef: string }> {
    if (this.env.PAYMENTS_PROVIDER === 'mock') {
      this.logger.debug(`mock refund ${amountAmd} AMD against ${providerRef}`);
      return { providerRef: `mock_refund_${randomUUID()}` };
    }
    throw new Error(`PAYMENTS_PROVIDER=${this.env.PAYMENTS_PROVIDER} has no refund adapter wired`);
  }
}
