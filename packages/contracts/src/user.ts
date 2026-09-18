import { z } from 'zod';
import { currencySchema, devicePlatformSchema, localeSchema, userRoleSchema } from './enums';
import { emailSchema, idSchema, isoDateTimeSchema, phoneSchema } from './common';

export const userSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1).max(120),
  phone: phoneSchema,
  email: emailSchema.nullable(),
  avatarUrl: z.string().url().nullable(),
  role: userRoleSchema,
  locale: localeSchema,
  currency: currencySchema,
  phoneVerified: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

/** The counters on the Profile screen. */
export const userStatsSchema = z.object({
  bookings: z.number().int().min(0),
  saved: z.number().int().min(0),
  reviews: z.number().int().min(0),
});
export type UserStats = z.infer<typeof userStatsSchema>;

export const meSchema = userSchema.extend({
  stats: userStatsSchema,
  unreadNotifications: z.number().int().min(0),
});
export type Me = z.infer<typeof meSchema>;

export const updateProfileSchema = z
  .object({
    fullName: z.string().min(1).max(120).optional(),
    email: emailSchema.nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    locale: localeSchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

/** Changing a phone number re-runs the SMS verification before it takes effect. */
export const changePhoneSchema = z.object({ phone: phoneSchema });
export type ChangePhoneBody = z.infer<typeof changePhoneSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

/** The four switches under Settings → Notifications. */
export const notificationPreferencesSchema = z.object({
  push: z.boolean(),
  sms: z.boolean(),
  email: z.boolean(),
  priceDrops: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesSchema = notificationPreferencesSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
export type UpdateNotificationPreferencesBody = z.infer<typeof updateNotificationPreferencesSchema>;

/** A phone or browser that can receive push notifications. */
export const registerDeviceSchema = z.object({
  pushToken: z.string().min(8).max(512),
  platform: devicePlatformSchema,
  /** Helps support answer "which phone was this?" without extra tracking. */
  deviceName: z.string().max(120).optional(),
  appVersion: z.string().max(32).optional(),
});
export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>;

/** The host card on the venue page: "Hosted by Marine K." */
export const hostSchema = z.object({
  id: idSchema,
  displayName: z.string().min(1).max(120),
  avatarUrl: z.string().url().nullable(),
  initials: z.string().min(1).max(3),
  bio: z.string().max(2000).nullable(),
  respondsWithinMinutes: z.number().int().positive().nullable(),
  memberSince: z.number().int().min(2000).max(2100),
  venueCount: z.number().int().min(0),
  ratingAvg: z.number().min(0).max(5).nullable(),
});
export type Host = z.infer<typeof hostSchema>;

/** Deleting an account is a request, not an instant wipe: bookings have a paper trail. */
export const deleteAccountSchema = z.object({
  reason: z.string().max(500).optional(),
  confirm: z.literal(true),
});
export type DeleteAccountBody = z.infer<typeof deleteAccountSchema>;
