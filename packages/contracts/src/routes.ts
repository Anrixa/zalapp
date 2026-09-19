/**
 * The route map.
 *
 * Both sides import these: NestJS controllers are mounted at them and the API
 * client builds its URLs from them. A path only exists in one place, so a
 * rename cannot leave the clients calling an endpoint that moved.
 *
 * Paths are relative to the API base (`/api/v1`), which the client holds.
 */

export const API_VERSION = 'v1';

export const routes = {
  health: () => '/health',
  config: {
    currencyRates: () => '/config/currency-rates',
    amenities: () => '/config/amenities',
  },

  auth: {
    register: () => '/auth/register',
    login: () => '/auth/login',
    google: () => '/auth/google',
    otpRequest: () => '/auth/otp/request',
    otpVerify: () => '/auth/otp/verify',
    otpResend: () => '/auth/otp/resend',
    refresh: () => '/auth/refresh',
    logout: () => '/auth/logout',
    forgotPassword: () => '/auth/password/forgot',
    resetPassword: () => '/auth/password/reset',
  },

  me: {
    get: () => '/me',
    update: () => '/me',
    changePassword: () => '/me/password',
    changePhone: () => '/me/phone',
    stats: () => '/me/stats',
    notificationPreferences: () => '/me/notification-preferences',
    devices: () => '/me/devices',
    device: (deviceId: string) => `/me/devices/${deviceId}`,
    paymentMethods: () => '/me/payment-methods',
    paymentMethod: (methodId: string) => `/me/payment-methods/${methodId}`,
    deleteAccount: () => '/me',
  },

  venues: {
    discover: () => '/venues/discover',
    search: () => '/venues',
    detail: (idOrSlug: string) => `/venues/${idOrSlug}`,
    availability: (venueId: string) => `/venues/${venueId}/availability`,
    quote: (venueId: string) => `/venues/${venueId}/quote`,
    reviews: (venueId: string) => `/venues/${venueId}/reviews`,
  },

  bookings: {
    list: () => '/bookings',
    create: () => '/bookings',
    detail: (bookingId: string) => `/bookings/${bookingId}`,
    cancel: (bookingId: string) => `/bookings/${bookingId}/cancel`,
    hostDecision: (bookingId: string) => `/bookings/${bookingId}/decision`,
    calendar: (bookingId: string) => `/bookings/${bookingId}/calendar`,
    review: (bookingId: string) => `/bookings/${bookingId}/review`,
  },

  payments: {
    createIntent: () => '/payments/intents',
    status: (paymentId: string) => `/payments/${paymentId}`,
    webhook: (provider: string) => `/payments/webhooks/${provider}`,
  },

  favorites: {
    list: () => '/favorites',
    toggle: () => '/favorites',
    remove: (venueId: string) => `/favorites/${venueId}`,
  },

  notifications: {
    list: () => '/notifications',
    unreadCount: () => '/notifications/unread-count',
    markRead: () => '/notifications/read',
  },

  messages: {
    conversations: () => '/conversations',
    conversation: (conversationId: string) => `/conversations/${conversationId}`,
    messages: (conversationId: string) => `/conversations/${conversationId}/messages`,
    start: () => '/conversations',
  },

  uploads: {
    presign: () => '/uploads/presign',
  },

  /**
   * Host-side management. Separate from the guest-facing `/venues` tree so the
   * authorisation rule is visible in the URL: everything under `/host` requires
   * the HOST role and ownership of the row being touched.
   */
  host: {
    venues: () => '/host/venues',
    venue: (venueId: string) => `/host/venues/${venueId}`,
    venueStatus: (venueId: string) => `/host/venues/${venueId}/status`,
    venuePrices: (venueId: string) => `/host/venues/${venueId}/prices`,
    venueAddOns: (venueId: string) => `/host/venues/${venueId}/add-ons`,
    venuePhotos: (venueId: string) => `/host/venues/${venueId}/photos`,
    venuePhoto: (venueId: string, photoId: string) => `/host/venues/${venueId}/photos/${photoId}`,
    venuePhotoOrder: (venueId: string) => `/host/venues/${venueId}/photos/order`,
    venueBlocks: (venueId: string) => `/host/venues/${venueId}/blocks`,
    bookings: () => '/host/bookings',
  },
} as const;

export type Routes = typeof routes;
