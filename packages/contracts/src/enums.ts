import { z } from 'zod';

/**
 * Every closed set of values the platform knows about.
 *
 * These mirror the Prisma enums one-for-one. Keeping them here — rather than
 * importing the generated Prisma client into the clients — is what lets the web
 * and mobile apps share the vocabulary without depending on the database layer.
 */

/** The venue categories offered on the Filters screen. */
export const VenueType = {
  BANQUET_HALL: 'BANQUET_HALL',
  RESTAURANT: 'RESTAURANT',
  GARDEN: 'GARDEN',
  ROOFTOP: 'ROOFTOP',
  CORPORATE: 'CORPORATE',
  OUTDOOR: 'OUTDOOR',
} as const;
export const venueTypeSchema = z.nativeEnum(VenueType);
export type VenueType = z.infer<typeof venueTypeSchema>;

/**
 * A venue day is sold as one of two blocks, never as arbitrary hours.
 * A hall is turned around between them, which is why the design offers exactly
 * these two choices and nothing in between.
 */
export const TimeSlot = {
  AFTERNOON: 'AFTERNOON',
  EVENING: 'EVENING',
} as const;
export const timeSlotSchema = z.nativeEnum(TimeSlot);
export type TimeSlot = z.infer<typeof timeSlotSchema>;

/** Wall-clock hours for each slot, in the venue's local time (Asia/Yerevan). */
export const SLOT_HOURS: Record<TimeSlot, { start: string; end: string }> = {
  AFTERNOON: { start: '12:00', end: '17:00' },
  EVENING: { start: '18:00', end: '23:59' },
};

/** What a guest is celebrating. Drives copy, not price. */
export const EventType = {
  WEDDING: 'WEDDING',
  BAPTISM: 'BAPTISM',
  BIRTHDAY: 'BIRTHDAY',
  ANNIVERSARY: 'ANNIVERSARY',
  ENGAGEMENT: 'ENGAGEMENT',
  CORPORATE: 'CORPORATE',
  OTHER: 'OTHER',
} as const;
export const eventTypeSchema = z.nativeEnum(EventType);
export type EventType = z.infer<typeof eventTypeSchema>;

/**
 * Booking lifecycle.
 *
 * PENDING_HOST   — guest paid the deposit, host has not accepted yet ("Awaiting host")
 * CONFIRMED      — host accepted; the date is locked
 * AWAITING_DEPOSIT — host pre-accepted a hold, deposit not yet paid ("Deposit due")
 * COMPLETED      — the event date has passed
 * CANCELLED_*    — who walked away decides the refund path
 * DECLINED       — host refused; deposit is refunded in full
 * EXPIRED        — the hold lapsed before the deposit was paid
 */
export const BookingStatus = {
  DRAFT: 'DRAFT',
  AWAITING_DEPOSIT: 'AWAITING_DEPOSIT',
  PENDING_HOST: 'PENDING_HOST',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED_BY_GUEST: 'CANCELLED_BY_GUEST',
  CANCELLED_BY_HOST: 'CANCELLED_BY_HOST',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const;
export const bookingStatusSchema = z.nativeEnum(BookingStatus);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

/** Statuses that still hold a date against a venue's calendar. */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.AWAITING_DEPOSIT,
  BookingStatus.PENDING_HOST,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

/** The three tabs on My bookings. */
export const BookingBucket = {
  UPCOMING: 'UPCOMING',
  PAST: 'PAST',
  CANCELLED: 'CANCELLED',
} as const;
export const bookingBucketSchema = z.nativeEnum(BookingBucket);
export type BookingBucket = z.infer<typeof bookingBucketSchema>;

/** Payment rails available in Armenia, as listed on the Payment screen. */
export const PaymentProvider = {
  CARD: 'CARD',
  IDRAM: 'IDRAM',
  TELCELL: 'TELCELL',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;
export const paymentProviderSchema = z.nativeEnum(PaymentProvider);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

/** Which slice of the total a payment covers. */
export const PaymentKind = {
  DEPOSIT: 'DEPOSIT',
  BALANCE: 'BALANCE',
  REFUND: 'REFUND',
} as const;
export const paymentKindSchema = z.nativeEnum(PaymentKind);
export type PaymentKind = z.infer<typeof paymentKindSchema>;

export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** Roles. A single user account can both book halls and host one. */
export const UserRole = {
  GUEST: 'GUEST',
  HOST: 'HOST',
  ADMIN: 'ADMIN',
} as const;
export const userRoleSchema = z.nativeEnum(UserRole);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Notification kinds shown on the Alerts tab. */
export const NotificationType = {
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_DECLINED: 'BOOKING_DECLINED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BALANCE_DUE: 'BALANCE_DUE',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  PRICE_DROP: 'PRICE_DROP',
  REVIEW_PUBLISHED: 'REVIEW_PUBLISHED',
  EVENT_REMINDER: 'EVENT_REMINDER',
} as const;
export const notificationTypeSchema = z.nativeEnum(NotificationType);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/** Availability of a single venue/date/slot triple. */
export const AvailabilityStatus = {
  OPEN: 'OPEN',
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED',
} as const;
export const availabilityStatusSchema = z.nativeEnum(AvailabilityStatus);
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;

/** Amenity codes. The labels live in the locale files, not here. */
export const AmenityCode = {
  PARKING: 'PARKING',
  CATERING: 'CATERING',
  SOUND_DJ: 'SOUND_DJ',
  OUTDOOR_TERRACE: 'OUTDOOR_TERRACE',
  AIR_CONDITIONING: 'AIR_CONDITIONING',
  DANCE_FLOOR: 'DANCE_FLOOR',
  PHOTOGRAPHY_ALLOWED: 'PHOTOGRAPHY_ALLOWED',
  WHEELCHAIR_ACCESS: 'WHEELCHAIR_ACCESS',
  KIDS_AREA: 'KIDS_AREA',
  SMOKING_AREA: 'SMOKING_AREA',
} as const;
export const amenityCodeSchema = z.nativeEnum(AmenityCode);
export type AmenityCode = z.infer<typeof amenityCodeSchema>;

/** Sort orders offered above the search results. */
export const VenueSort = {
  RECOMMENDED: 'RECOMMENDED',
  TOP_RATED: 'TOP_RATED',
  PRICE_ASC: 'PRICE_ASC',
  PRICE_DESC: 'PRICE_DESC',
  CAPACITY_DESC: 'CAPACITY_DESC',
  NEWEST: 'NEWEST',
} as const;
export const venueSortSchema = z.nativeEnum(VenueSort);
export type VenueSort = z.infer<typeof venueSortSchema>;

/** Interface languages. Armenian is the default. */
export const Locale = { hy: 'hy', en: 'en', ru: 'ru' } as const;
export const localeSchema = z.nativeEnum(Locale);
export type Locale = z.infer<typeof localeSchema>;

/**
 * Display currencies. AMD is the settlement currency — everything is stored in
 * AMD and only converted for display.
 */
export const Currency = { AMD: 'AMD', USD: 'USD', EUR: 'EUR' } as const;
export const currencySchema = z.nativeEnum(Currency);
export type Currency = z.infer<typeof currencySchema>;

export const DevicePlatform = { IOS: 'IOS', ANDROID: 'ANDROID', WEB: 'WEB' } as const;
export const devicePlatformSchema = z.nativeEnum(DevicePlatform);
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;
