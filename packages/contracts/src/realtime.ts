import { z } from 'zod';
import { idSchema } from './common';
import { bookingStatusSchema, paymentStatusSchema } from './enums';
import { notificationSchema, messageSchema } from './social';

/**
 * The realtime channel.
 *
 * Socket.IO namespace `/realtime`. A client connects with its access token in
 * the handshake `auth.token`, the server puts it in the room `user:{id}`, and
 * every event below is addressed to that room.
 *
 * The payloads are deliberately thin: an event says *what changed*, and the
 * client refetches the affected query. That way a screen never has to merge a
 * partial object into cached state and get it subtly wrong — and a client that
 * missed an event while backgrounded is corrected by its next fetch anyway.
 */

export const REALTIME_NAMESPACE = '/realtime';

export const RealtimeEvent = {
  BOOKING_UPDATED: 'booking.updated',
  PAYMENT_UPDATED: 'payment.updated',
  NOTIFICATION_CREATED: 'notification.created',
  MESSAGE_CREATED: 'message.created',
  UNREAD_COUNT: 'notification.unread',
} as const;
export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export const bookingUpdatedPayloadSchema = z.object({
  bookingId: idSchema,
  status: bookingStatusSchema,
  venueId: idSchema,
});
export type BookingUpdatedPayload = z.infer<typeof bookingUpdatedPayloadSchema>;

export const paymentUpdatedPayloadSchema = z.object({
  paymentId: idSchema,
  bookingId: idSchema,
  status: paymentStatusSchema,
});
export type PaymentUpdatedPayload = z.infer<typeof paymentUpdatedPayloadSchema>;

export const notificationCreatedPayloadSchema = z.object({
  notification: notificationSchema,
  unread: z.number().int().min(0),
});
export type NotificationCreatedPayload = z.infer<typeof notificationCreatedPayloadSchema>;

export const messageCreatedPayloadSchema = z.object({
  message: messageSchema,
  conversationId: idSchema,
});
export type MessageCreatedPayload = z.infer<typeof messageCreatedPayloadSchema>;

export const unreadCountPayloadSchema = z.object({ unread: z.number().int().min(0) });
export type UnreadCountPayload = z.infer<typeof unreadCountPayloadSchema>;

/** Maps each event name to the schema of its payload. */
export const REALTIME_PAYLOADS = {
  [RealtimeEvent.BOOKING_UPDATED]: bookingUpdatedPayloadSchema,
  [RealtimeEvent.PAYMENT_UPDATED]: paymentUpdatedPayloadSchema,
  [RealtimeEvent.NOTIFICATION_CREATED]: notificationCreatedPayloadSchema,
  [RealtimeEvent.MESSAGE_CREATED]: messageCreatedPayloadSchema,
  [RealtimeEvent.UNREAD_COUNT]: unreadCountPayloadSchema,
} as const;

export type RealtimePayloadMap = {
  [RealtimeEvent.BOOKING_UPDATED]: BookingUpdatedPayload;
  [RealtimeEvent.PAYMENT_UPDATED]: PaymentUpdatedPayload;
  [RealtimeEvent.NOTIFICATION_CREATED]: NotificationCreatedPayload;
  [RealtimeEvent.MESSAGE_CREATED]: MessageCreatedPayload;
  [RealtimeEvent.UNREAD_COUNT]: UnreadCountPayload;
};

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function venueRoom(venueId: string): string {
  return `venue:${venueId}`;
}
