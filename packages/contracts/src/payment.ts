import { z } from 'zod';
import { amdSchema, idSchema, isoDateTimeSchema } from './common';
import { paymentKindSchema, paymentProviderSchema, paymentStatusSchema } from './enums';

/**
 * Payments.
 *
 * Card details never reach Zal's servers. The client asks for an intent, gets
 * back either a redirect URL (ArCa 3-D Secure, Idram, Telcell) or a
 * client-side token, and the provider calls a webhook when the money moves.
 * The API treats its own optimistic state as provisional until that webhook
 * lands, which is why `status` has a PROCESSING value the UI must handle.
 */

export const savedPaymentMethodSchema = z.object({
  id: idSchema,
  provider: paymentProviderSchema,
  /** `VISA`, `MASTERCARD`, `ARCA` — or the wallet's name for non-card rails. */
  brand: z.string().min(1).max(32),
  last4: z.string().length(4).nullable(),
  expiryMonth: z.number().int().min(1).max(12).nullable(),
  expiryYear: z.number().int().min(2024).max(2100).nullable(),
  isDefault: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type SavedPaymentMethod = z.infer<typeof savedPaymentMethodSchema>;

export const paymentSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  kind: paymentKindSchema,
  provider: paymentProviderSchema,
  status: paymentStatusSchema,
  amountAmd: z.number().int(),
  /** The provider's own id, shown to support when something needs chasing. */
  providerRef: z.string().max(120).nullable(),
  failureCode: z.string().max(64).nullable(),
  createdAt: isoDateTimeSchema,
  settledAt: isoDateTimeSchema.nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Start a payment. Everything sensitive is collected by the provider, not by us. */
export const createPaymentIntentSchema = z.object({
  bookingId: idSchema,
  kind: paymentKindSchema.default('DEPOSIT'),
  provider: paymentProviderSchema,
  /** Charge a card already on file instead of collecting one. */
  savedMethodId: idSchema.optional(),
  /** Whether to keep the card for next time, when the provider supports it. */
  savePaymentMethod: z.boolean().default(false),
  /** Where the provider should send the browser back to after 3-D Secure. */
  returnUrl: z.string().url().optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});
export type CreatePaymentIntentBody = z.infer<typeof createPaymentIntentSchema>;

export const paymentIntentSchema = z.object({
  paymentId: idSchema,
  status: paymentStatusSchema,
  amountAmd: amdSchema,
  provider: paymentProviderSchema,
  /**
   * Exactly one of these is set:
   *  • `redirectUrl` — send the guest to the provider (ArCa 3-D Secure, wallets)
   *  • `clientSecret` — hand to a provider SDK that collects the card in-app
   *  • `bankTransfer` — show the guest the details to pay manually
   */
  redirectUrl: z.string().url().nullable(),
  clientSecret: z.string().max(512).nullable(),
  bankTransfer: z
    .object({
      beneficiary: z.string().max(160),
      iban: z.string().max(40),
      bank: z.string().max(120),
      reference: z.string().max(64),
      note: z.string().max(300),
    })
    .nullable(),
});
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;

/** Polled after a redirect comes back, until the webhook has settled things. */
export const paymentStatusResponseSchema = z.object({
  payment: paymentSchema,
  bookingStatus: z.string(),
});
export type PaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;

export const addPaymentMethodSchema = z.object({
  provider: paymentProviderSchema,
  /** A single-use token from the provider's SDK. Never a PAN. */
  providerToken: z.string().min(8).max(512),
  makeDefault: z.boolean().default(false),
});
export type AddPaymentMethodBody = z.infer<typeof addPaymentMethodSchema>;

/**
 * Card-shaped fields the Payment screen collects **only** when the provider
 * SDK tokenises them in the browser or app. They are defined here so both
 * clients validate identically before handing off — the API has no endpoint
 * that accepts them.
 */
export const cardInputSchema = z.object({
  number: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => /^\d{13,19}$/.test(value), 'Check the card number')
    .refine(luhn, 'Check the card number'),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\s?\/\s?(\d{2})$/, 'Use MM/YY'),
  cvc: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, 'Check the CVC'),
  holder: z.string().trim().min(2).max(120),
});
export type CardInput = z.infer<typeof cardInputSchema>;

/** Luhn checksum — catches a mistyped digit before the network round trip. */
export function luhn(value: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = value.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}
