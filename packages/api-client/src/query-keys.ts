import type {
  ListBookingsQuery,
  ListNotificationsQuery,
  ListReviewsQuery,
  VenueSearchQuery,
} from '@zal/contracts';

/**
 * Query keys, in one place.
 *
 * Hierarchical on purpose: `queryKeys.venues.all` invalidates every venue query
 * including searches and details, while `queryKeys.venues.detail(id)` touches
 * one. Inventing keys at call sites is how a mutation ends up invalidating
 * nothing and a screen shows stale data nobody can reproduce.
 */
export const queryKeys = {
  me: {
    all: ['me'] as const,
    profile: () => ['me', 'profile'] as const,
    stats: () => ['me', 'stats'] as const,
    notificationPreferences: () => ['me', 'notification-preferences'] as const,
    paymentMethods: () => ['me', 'payment-methods'] as const,
  },

  venues: {
    all: ['venues'] as const,
    discover: () => ['venues', 'discover'] as const,
    search: (query: Partial<VenueSearchQuery>) => ['venues', 'search', query] as const,
    detail: (idOrSlug: string) => ['venues', 'detail', idOrSlug] as const,
    availability: (venueId: string, from: string, to: string) =>
      ['venues', 'availability', venueId, from, to] as const,
    reviews: (venueId: string, query: Partial<ListReviewsQuery>) =>
      ['venues', 'reviews', venueId, query] as const,
    quote: (venueId: string, input: unknown) => ['venues', 'quote', venueId, input] as const,
  },

  bookings: {
    all: ['bookings'] as const,
    list: (query: Partial<ListBookingsQuery>) => ['bookings', 'list', query] as const,
    detail: (bookingId: string) => ['bookings', 'detail', bookingId] as const,
  },

  favorites: {
    all: ['favorites'] as const,
    list: () => ['favorites', 'list'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: (query: Partial<ListNotificationsQuery>) => ['notifications', 'list', query] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },

  messages: {
    all: ['messages'] as const,
    conversations: () => ['messages', 'conversations'] as const,
    thread: (conversationId: string) => ['messages', 'thread', conversationId] as const,
  },

  config: {
    currencyRates: () => ['config', 'currency-rates'] as const,
  },
} as const;
