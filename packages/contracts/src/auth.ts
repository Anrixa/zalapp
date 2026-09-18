import { z } from 'zod';
import { emailSchema, idSchema, passwordSchema, phoneSchema } from './common';
import { localeSchema } from './enums';
import { userSchema } from './user';

/**
 * Auth.
 *
 * The primary path is the one in the design: phone number, then a 6-digit SMS
 * code. Email and password exist for people who prefer them, and Google
 * sign-in for the "Continue with Google" button on both auth screens.
 *
 * Tokens: a 15-minute access token sent as `Authorization: Bearer`, and a
 * 30-day refresh token that is rotated on every use. Web keeps the refresh
 * token in an httpOnly cookie, mobile in the OS keychain; the shape below is
 * the same either way, and `refreshToken` is simply omitted from the body when
 * the server has set the cookie instead.
 */

export const tokenPairSchema = z.object({
  accessToken: z.string().min(16),
  /** Absent on web, where the refresh token is delivered as an httpOnly cookie. */
  refreshToken: z.string().min(16).optional(),
  /** Seconds until `accessToken` expires. */
  expiresIn: z.number().int().positive(),
  tokenType: z.literal('Bearer').default('Bearer'),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const authSessionSchema = tokenPairSchema.extend({
  user: userSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/**
 * Handed back by any endpoint that has just sent an SMS code. The client shows
 * the OTP screen and posts this id back with whatever the guest typed — the
 * phone number itself never travels again, so a leaked id is worth nothing.
 */
export const verificationChallengeSchema = z.object({
  verificationId: idSchema,
  /** Masked for display: `+374 •• ••• 456`. */
  phoneHint: z.string().min(4).max(32),
  expiresIn: z.number().int().positive(),
  resendAfter: z.number().int().min(0),
});
export type VerificationChallenge = z.infer<typeof verificationChallengeSchema>;

export const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  email: emailSchema.optional(),
  password: passwordSchema,
  locale: localeSchema.default('hy'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You need to accept the Terms of Service to continue' }),
  }),
});
export type RegisterBody = z.infer<typeof registerSchema>;

/** Log in with phone-or-email plus password, exactly as the Login screen offers. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
});
export type LoginBody = z.infer<typeof loginSchema>;

/** Passwordless entry: ask for a code, then verify it. */
export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['LOGIN', 'VERIFY_PHONE', 'RESET_PASSWORD']).default('LOGIN'),
});
export type OtpRequestBody = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  verificationId: idSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'The code is 6 digits'),
});
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;

export const otpResendSchema = z.object({ verificationId: idSchema });
export type OtpResendBody = z.infer<typeof otpResendSchema>;

/**
 * Google sign-in. The client runs the native or web Google flow and posts the
 * resulting ID token; the API verifies it against Google's keys rather than
 * trusting anything the client decoded itself.
 */
export const googleSignInSchema = z.object({
  idToken: z.string().min(16),
  locale: localeSchema.optional(),
});
export type GoogleSignInBody = z.infer<typeof googleSignInSchema>;

export const refreshSchema = z.object({
  /** Omitted on web: the cookie carries it. */
  refreshToken: z.string().min(16).optional(),
});
export type RefreshBody = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(16).optional(),
  /** Sign out everywhere, not just this device. */
  allDevices: z.boolean().default(false),
});
export type LogoutBody = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({ phone: phoneSchema });
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  verificationId: idSchema,
  code: z.string().regex(/^\d{6}$/),
  newPassword: passwordSchema,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

/** Claims the API puts in the access token. */
export const accessTokenClaimsSchema = z.object({
  sub: idSchema,
  role: z.string(),
  /** Session family id — lets a single device be revoked without touching the others. */
  sid: idSchema,
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

/** Mask a phone for the OTP screen: `+374 •• ••• 456`. */
export function maskPhone(phone: string): string {
  const tail = phone.slice(-3);
  const head = phone.slice(0, 4);
  return `${head} •• ••• ${tail}`;
}
