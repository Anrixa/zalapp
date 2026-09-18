import { z } from 'zod';
import { idSchema, isoDateTimeSchema, paginationQuerySchema } from './common';
import { eventTypeSchema, notificationTypeSchema } from './enums';
import { venueSummarySchema } from './venue';

/* ── Reviews ────────────────────────────────────────────────────────────── */

export const reviewAuthorSchema = z.object({
  id: idSchema,
  displayName: z.string().min(1).max(120),
  initials: z.string().min(1).max(3),
  avatarUrl: z.string().url().nullable(),
});

export const reviewSchema = z.object({
  id: idSchema,
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).nullable(),
  eventType: eventTypeSchema,
  /** "Wedding · August 2026" — the month of the event, not of the review. */
  eventMonth: z.string().max(32),
  author: reviewAuthorSchema,
  hostReply: z.string().max(1000).nullable(),
  createdAt: isoDateTimeSchema,
});
export type Review = z.infer<typeof reviewSchema>;

/**
 * Reviews come from real bookings only — the venue page says so, and the API
 * enforces it: `bookingId` must be a completed booking belonging to the author.
 */
export const createReviewSchema = z.object({
  bookingId: idSchema,
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
});
export type CreateReviewBody = z.infer<typeof createReviewSchema>;

export const listReviewsQuerySchema = paginationQuerySchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['NEWEST', 'HIGHEST', 'LOWEST']).default('NEWEST'),
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

/* ── Favorites ──────────────────────────────────────────────────────────── */

export const favoriteSchema = z.object({
  venue: venueSummarySchema,
  savedAt: isoDateTimeSchema,
});
export type Favorite = z.infer<typeof favoriteSchema>;

export const toggleFavoriteSchema = z.object({ venueId: idSchema });
export type ToggleFavoriteBody = z.infer<typeof toggleFavoriteSchema>;

export const favoriteStateSchema = z.object({
  venueId: idSchema,
  isSaved: z.boolean(),
  savedCount: z.number().int().min(0),
});
export type FavoriteState = z.infer<typeof favoriteStateSchema>;

/* ── Notifications ──────────────────────────────────────────────────────── */

/**
 * A notification is a typed payload plus pre-rendered text. The server renders
 * the sentence in the user's locale so the two clients don't each need a copy
 * of the phrasing rules; `data` is there for deep-linking, not for display.
 */
export const notificationSchema = z.object({
  id: idSchema,
  type: notificationTypeSchema,
  title: z.string().max(160),
  body: z.string().max(400),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  data: z
    .object({
      bookingId: idSchema.optional(),
      venueId: idSchema.optional(),
      conversationId: idSchema.optional(),
      amountAmd: z.number().int().optional(),
    })
    .default({}),
});
export type Notification = z.infer<typeof notificationSchema>;

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().default(false),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const markNotificationsReadSchema = z.object({
  /** Omit to mark everything read — what the "Mark all read" link does. */
  ids: z.array(idSchema).max(200).optional(),
});
export type MarkNotificationsReadBody = z.infer<typeof markNotificationsReadSchema>;

export const unreadCountSchema = z.object({ unread: z.number().int().min(0) });

/* ── Messages ───────────────────────────────────────────────────────────── */

export const messageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  senderId: idSchema,
  body: z.string().min(1).max(4000),
  createdAt: isoDateTimeSchema,
  readAt: isoDateTimeSchema.nullable(),
});
export type Message = z.infer<typeof messageSchema>;

export const conversationSchema = z.object({
  id: idSchema,
  bookingId: idSchema.nullable(),
  venueId: idSchema,
  venueName: z.string().max(160),
  counterpartName: z.string().max(120),
  counterpartInitials: z.string().max(3),
  counterpartAvatarUrl: z.string().url().nullable(),
  lastMessage: messageSchema.nullable(),
  unreadCount: z.number().int().min(0),
  updatedAt: isoDateTimeSchema,
});
export type Conversation = z.infer<typeof conversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  idempotencyKey: z.string().min(8).max(64).optional(),
});
export type SendMessageBody = z.infer<typeof sendMessageSchema>;

export const startConversationSchema = z.object({
  venueId: idSchema,
  bookingId: idSchema.optional(),
  body: z.string().trim().min(1).max(4000),
});
export type StartConversationBody = z.infer<typeof startConversationSchema>;
