import { z } from 'zod';

/**
 * Machine-readable failure reasons.
 *
 * Clients switch on `code`, never on the message: the message is localised for
 * display and will change; the code is part of the contract and will not.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',

  // Auth
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_TOO_SOON: 'OTP_RESEND_TOO_SOON',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',

  // Booking
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  SLOT_IN_THE_PAST: 'SLOT_IN_THE_PAST',
  OVER_CAPACITY: 'OVER_CAPACITY',
  BOOKING_NOT_CANCELLABLE: 'BOOKING_NOT_CANCELLABLE',
  BOOKING_ALREADY_PAID: 'BOOKING_ALREADY_PAID',
  ADDON_NOT_AVAILABLE: 'ADDON_NOT_AVAILABLE',

  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_ALREADY_SETTLED: 'PAYMENT_ALREADY_SETTLED',

  // Reviews
  REVIEW_NOT_ALLOWED: 'REVIEW_NOT_ALLOWED',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

/**
 * The single error envelope every endpoint uses. One shape means the clients
 * need exactly one error branch, not one per endpoint.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Present when `code` is VALIDATION_FAILED. */
    fields: z.array(fieldErrorSchema).optional(),
    /** Seconds to wait, present when `code` is RATE_LIMITED or OTP_RESEND_TOO_SOON. */
    retryAfter: z.number().int().positive().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const HTTP_STATUS_BY_ERROR_CODE: Record<string, number> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.REFRESH_TOKEN_INVALID]: 401,
  [ErrorCode.REFRESH_TOKEN_REUSED]: 401,
  [ErrorCode.PHONE_NOT_VERIFIED]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.PHONE_ALREADY_REGISTERED]: 409,
  [ErrorCode.EMAIL_ALREADY_REGISTERED]: 409,
  [ErrorCode.SLOT_UNAVAILABLE]: 409,
  [ErrorCode.BOOKING_ALREADY_PAID]: 409,
  [ErrorCode.PAYMENT_ALREADY_SETTLED]: 409,
  [ErrorCode.REVIEW_ALREADY_EXISTS]: 409,
  [ErrorCode.SLOT_IN_THE_PAST]: 422,
  [ErrorCode.OVER_CAPACITY]: 422,
  [ErrorCode.BOOKING_NOT_CANCELLABLE]: 422,
  [ErrorCode.ADDON_NOT_AVAILABLE]: 422,
  [ErrorCode.REVIEW_NOT_ALLOWED]: 422,
  [ErrorCode.OTP_INVALID]: 422,
  [ErrorCode.OTP_EXPIRED]: 422,
  [ErrorCode.PAYMENT_FAILED]: 422,
  [ErrorCode.OTP_TOO_MANY_ATTEMPTS]: 429,
  [ErrorCode.OTP_RESEND_TOO_SOON]: 429,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL]: 500,
};

export function httpStatusForErrorCode(code: string): number {
  return HTTP_STATUS_BY_ERROR_CODE[code] ?? 500;
}
