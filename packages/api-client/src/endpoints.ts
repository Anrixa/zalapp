import {
  authSessionSchema,
  availabilityResponseSchema,
  bookingDetailSchema,
  bookingSummarySchema,
  conversationSchema,
  discoverSchema,
  favoriteSchema,
  favoriteStateSchema,
  meSchema,
  messageSchema,
  notificationPreferencesSchema,
  notificationSchema,
  pageSchema,
  paymentIntentSchema,
  paymentStatusResponseSchema,
  quoteSchema,
  refundOutcomeSchema,
  reviewSchema,
  routes,
  savedPaymentMethodSchema,
  tokenPairSchema,
  userStatsSchema,
  venueDetailSchema,
  venueSearchResultSchema,
  verificationChallengeSchema,
  type AddPaymentMethodBody,
  type CancelBookingBody,
  type ChangePasswordBody,
  type CreateBookingBody,
  type CreatePaymentIntentBody,
  type CreateReviewBody,
  type GoogleSignInBody,
  type ListBookingsQuery,
  type ListNotificationsQuery,
  type ListReviewsQuery,
  type LoginBody,
  type OtpRequestBody,
  type QuoteRequestBody,
  type RegisterBody,
  type RegisterDeviceBody,
  type SendMessageBody,
  type StartConversationBody,
  type UpdateNotificationPreferencesBody,
  type UpdateProfileBody,
  type VenueSearchQuery,
} from '@zal/contracts';
import { z } from 'zod';
import type { ZalClient } from './http';

const okSchema = z.object({ ok: z.literal(true) });
const calendarLinksSchema = z.object({ ics: z.string(), google: z.string() });
const currencyRatesSchema = z.object({
  base: z.string(),
  rates: z.record(z.string(), z.number()),
  fetchedAt: z.string(),
});

/**
 * Every endpoint, as a typed method.
 *
 * Each one names its response schema, so a response the server changes without
 * telling anyone fails at the boundary rather than three screens later. Paths
 * come from the contract's route map — no URL is spelled out twice in this
 * repository.
 */
export function createApi(client: ZalClient) {
  return {
    config: {
      currencyRates: () =>
        client.request(routes.config.currencyRates(), {
          schema: currencyRatesSchema,
          anonymous: true,
        }),
    },

    auth: {
      register: (body: RegisterBody) =>
        client.request(routes.auth.register(), {
          method: 'POST',
          body,
          schema: verificationChallengeSchema,
          anonymous: true,
        }),

      login: async (body: LoginBody) => {
        const session = await client.request(routes.auth.login(), {
          method: 'POST',
          body,
          schema: authSessionSchema,
          anonymous: true,
        });
        await client.adoptSession(session);
        return session;
      },

      requestOtp: (body: OtpRequestBody) =>
        client.request(routes.auth.otpRequest(), {
          method: 'POST',
          body,
          schema: verificationChallengeSchema,
          anonymous: true,
        }),

      resendOtp: (verificationId: string) =>
        client.request(routes.auth.otpResend(), {
          method: 'POST',
          body: { verificationId },
          schema: verificationChallengeSchema,
          anonymous: true,
        }),

      verifyOtp: async (body: { verificationId: string; code: string }) => {
        const session = await client.request(routes.auth.otpVerify(), {
          method: 'POST',
          body,
          schema: authSessionSchema,
          anonymous: true,
        });
        await client.adoptSession(session);
        return session;
      },

      google: async (body: GoogleSignInBody) => {
        const session = await client.request(routes.auth.google(), {
          method: 'POST',
          body,
          schema: authSessionSchema,
          anonymous: true,
        });
        await client.adoptSession(session);
        return session;
      },

      refresh: () =>
        client.request(routes.auth.refresh(), {
          method: 'POST',
          body: {},
          schema: tokenPairSchema,
          anonymous: true,
        }),

      logout: async (allDevices = false) => {
        const refreshToken = await client.storage.getRefreshToken();
        try {
          await client.request(routes.auth.logout(), {
            method: 'POST',
            body: { allDevices, ...(refreshToken ? { refreshToken } : {}) },
          });
        } finally {
          // Sign out locally whatever the server said: a guest who pressed
          // Log out must not stay signed in because the network was down.
          await client.clearSession();
        }
      },

      forgotPassword: (phone: string) =>
        client.request(routes.auth.forgotPassword(), {
          method: 'POST',
          body: { phone },
          schema: verificationChallengeSchema,
          anonymous: true,
        }),

      resetPassword: (body: { verificationId: string; code: string; newPassword: string }) =>
        client.request(routes.auth.resetPassword(), {
          method: 'POST',
          body,
          schema: okSchema,
          anonymous: true,
        }),
    },

    me: {
      get: () => client.request(routes.me.get(), { schema: meSchema }),

      update: (body: UpdateProfileBody) =>
        client.request(routes.me.update(), { method: 'PATCH', body, schema: meSchema }),

      stats: () => client.request(routes.me.stats(), { schema: userStatsSchema }),

      changePassword: (body: ChangePasswordBody) =>
        client.request(routes.me.changePassword(), { method: 'PUT', body, schema: okSchema }),

      requestPhoneChange: (phone: string) =>
        client.request(routes.me.changePhone(), {
          method: 'POST',
          body: { phone },
          schema: verificationChallengeSchema,
        }),

      confirmPhoneChange: (body: { verificationId: string; code: string }) =>
        client.request(routes.me.changePhone(), { method: 'PUT', body, schema: meSchema }),

      notificationPreferences: () =>
        client.request(routes.me.notificationPreferences(), {
          schema: notificationPreferencesSchema,
        }),

      updateNotificationPreferences: (body: UpdateNotificationPreferencesBody) =>
        client.request(routes.me.notificationPreferences(), {
          method: 'PATCH',
          body,
          schema: notificationPreferencesSchema,
        }),

      registerDevice: (body: RegisterDeviceBody) =>
        client.request(routes.me.devices(), { method: 'POST', body, schema: okSchema }),

      paymentMethods: () =>
        client.request(routes.me.paymentMethods(), {
          schema: z.array(savedPaymentMethodSchema),
        }),

      addPaymentMethod: (
        body: AddPaymentMethodBody & {
          brand: string;
          last4: string | null;
          expiryMonth?: number;
          expiryYear?: number;
        },
      ) =>
        client.request(routes.me.paymentMethods(), {
          method: 'POST',
          body,
          schema: savedPaymentMethodSchema,
        }),

      removePaymentMethod: (methodId: string) =>
        client.request(routes.me.paymentMethod(methodId), {
          method: 'DELETE',
          schema: okSchema,
        }),

      deleteAccount: (reason?: string) =>
        client.request(routes.me.deleteAccount(), {
          method: 'DELETE',
          body: { confirm: true, ...(reason ? { reason } : {}) },
          schema: okSchema,
        }),
    },

    venues: {
      discover: () => client.request(routes.venues.discover(), { schema: discoverSchema }),

      search: (query: Partial<VenueSearchQuery>) =>
        client.request(routes.venues.search(), {
          query: query as Record<string, unknown>,
          schema: venueSearchResultSchema,
        }),

      detail: (idOrSlug: string) =>
        client.request(routes.venues.detail(idOrSlug), { schema: venueDetailSchema }),

      availability: (venueId: string, from: string, to: string) =>
        client.request(routes.venues.availability(venueId), {
          query: { from, to },
          schema: availabilityResponseSchema,
        }),

      quote: (venueId: string, body: QuoteRequestBody) =>
        client.request(routes.venues.quote(venueId), {
          method: 'POST',
          body,
          schema: quoteSchema.extend({ available: z.boolean() }),
        }),

      reviews: (venueId: string, query: Partial<ListReviewsQuery> = {}) =>
        client.request(routes.venues.reviews(venueId), {
          query: query as Record<string, unknown>,
          schema: pageSchema(reviewSchema),
        }),
    },

    bookings: {
      list: (query: Partial<ListBookingsQuery> = {}) =>
        client.request(routes.bookings.list(), {
          query: query as Record<string, unknown>,
          schema: pageSchema(bookingSummarySchema),
        }),

      create: (body: CreateBookingBody) =>
        client.request(routes.bookings.create(), {
          method: 'POST',
          body,
          schema: bookingDetailSchema,
        }),

      detail: (bookingId: string) =>
        client.request(routes.bookings.detail(bookingId), { schema: bookingDetailSchema }),

      cancel: (bookingId: string, body: CancelBookingBody = {}) =>
        client.request(routes.bookings.cancel(bookingId), {
          method: 'POST',
          body,
          schema: z.object({ booking: bookingDetailSchema, refund: refundOutcomeSchema }),
        }),

      calendar: (bookingId: string) =>
        client.request(routes.bookings.calendar(bookingId), { schema: calendarLinksSchema }),

      review: (bookingId: string, body: Omit<CreateReviewBody, 'bookingId'>) =>
        client.request(routes.bookings.review(bookingId), {
          method: 'POST',
          body,
          schema: reviewSchema,
        }),
    },

    payments: {
      createIntent: (body: CreatePaymentIntentBody) =>
        client.request(routes.payments.createIntent(), {
          method: 'POST',
          body,
          schema: paymentIntentSchema,
        }),

      status: (paymentId: string) =>
        client.request(routes.payments.status(paymentId), {
          schema: paymentStatusResponseSchema,
        }),
    },

    favorites: {
      list: (query: { cursor?: string; limit?: number } = {}) =>
        client.request(routes.favorites.list(), {
          query,
          schema: pageSchema(favoriteSchema),
        }),

      toggle: (venueId: string) =>
        client.request(routes.favorites.toggle(), {
          method: 'POST',
          body: { venueId },
          schema: favoriteStateSchema,
        }),

      remove: (venueId: string) =>
        client.request(routes.favorites.remove(venueId), {
          method: 'DELETE',
          schema: favoriteStateSchema,
        }),
    },

    notifications: {
      list: (query: Partial<ListNotificationsQuery> = {}) =>
        client.request(routes.notifications.list(), {
          query: query as Record<string, unknown>,
          schema: pageSchema(notificationSchema),
        }),

      unreadCount: () =>
        client.request(routes.notifications.unreadCount(), {
          schema: z.object({ unread: z.number() }),
        }),

      markRead: (ids?: string[]) =>
        client.request(routes.notifications.markRead(), {
          method: 'POST',
          body: ids ? { ids } : {},
          schema: z.object({ unread: z.number() }),
        }),
    },

    messages: {
      conversations: (query: { cursor?: string; limit?: number } = {}) =>
        client.request(routes.messages.conversations(), {
          query,
          schema: pageSchema(conversationSchema),
        }),

      messages: (conversationId: string, query: { cursor?: string; limit?: number } = {}) =>
        client.request(routes.messages.messages(conversationId), {
          query,
          schema: pageSchema(messageSchema),
        }),

      send: (conversationId: string, body: SendMessageBody) =>
        client.request(routes.messages.messages(conversationId), {
          method: 'POST',
          body,
          schema: messageSchema,
        }),

      start: (body: StartConversationBody) =>
        client.request(routes.messages.start(), {
          method: 'POST',
          body,
          schema: conversationSchema,
        }),
    },
  };
}

export type ZalApi = ReturnType<typeof createApi>;
