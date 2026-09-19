import { useEffect } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type {
  CancelBookingBody,
  CreateBookingBody,
  CreatePaymentIntentBody,
  CreateReviewBody,
  FavoriteState,
  ListBookingsQuery,
  ListNotificationsQuery,
  ListReviewsQuery,
  LoginBody,
  QuoteRequestBody,
  RegisterBody,
  SendMessageBody,
  UpdateNotificationPreferencesBody,
  UpdateProfileBody,
  VenueSearchQuery,
  VenueSummary,
} from '@zal/contracts';
import { useZal, useZalApi } from './provider';
import { queryKeys } from './query-keys';

/* ── Session ────────────────────────────────────────────────────────────── */

export function useMe(options: { enabled?: boolean } = {}) {
  const api = useZalApi();
  const { ready } = useZal();

  return useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.me.get(),
    // Waiting for `ready` keeps a cold start from firing an unauthenticated
    // request that would only bounce the guest to Login for a moment.
    enabled: (options.enabled ?? true) && ready,
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin(): UseMutationResult<unknown, Error, LoginBody> {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: LoginBody) => api.auth.login(body),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useRegister() {
  const api = useZalApi();
  return useMutation({ mutationFn: (body: RegisterBody) => api.auth.register(body) });
}

export function useRequestOtp() {
  const api = useZalApi();
  return useMutation({
    mutationFn: (phone: string) => api.auth.requestOtp({ phone, purpose: 'LOGIN' }),
  });
}

export function useVerifyOtp() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { verificationId: string; code: string }) => api.auth.verifyOtp(body),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useLogout() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (allDevices?: boolean) => api.auth.logout(allDevices),
    // Clear rather than invalidate: refetching another guest's cached data
    // would be worse than an empty screen.
    onSettled: () => queryClient.clear(),
  });
}

export function useUpdateProfile() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProfileBody) => api.me.update(body),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me.profile(), me);
    },
  });
}

/* ── Discovery ──────────────────────────────────────────────────────────── */

export function useDiscover() {
  const api = useZalApi();
  return useQuery({ queryKey: queryKeys.venues.discover(), queryFn: () => api.venues.discover() });
}

export function useVenueSearch(query: Partial<VenueSearchQuery>) {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.venues.search(query),
    queryFn: ({ pageParam }) =>
      api.venues.search({ ...query, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useVenue(idOrSlug: string | undefined) {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.venues.detail(idOrSlug ?? ''),
    queryFn: () => api.venues.detail(idOrSlug as string),
    enabled: Boolean(idOrSlug),
  });
}

export function useAvailability(venueId: string | undefined, from: string, to: string) {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.venues.availability(venueId ?? '', from, to),
    queryFn: () => api.venues.availability(venueId as string, from, to),
    enabled: Boolean(venueId),
    // A calendar goes stale the moment somebody else books: short and honest.
    staleTime: 15_000,
  });
}

/**
 * The live price for the current selection.
 *
 * A query rather than a mutation even though it POSTs: it is a read that
 * happens to need a body, and modelling it as a query is what gives the
 * Checkout screen caching, deduplication and a loading state for free.
 */
export function useQuote(venueId: string | undefined, input: QuoteRequestBody | null) {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.venues.quote(venueId ?? '', input),
    queryFn: () => api.venues.quote(venueId as string, input as QuoteRequestBody),
    enabled: Boolean(venueId && input),
    staleTime: 30_000,
  });
}

export function useVenueReviews(
  venueId: string | undefined,
  query: Partial<ListReviewsQuery> = {},
) {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.venues.reviews(venueId ?? '', query),
    queryFn: ({ pageParam }) =>
      api.venues.reviews(venueId as string, {
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(venueId),
  });
}

/* ── Bookings ───────────────────────────────────────────────────────────── */

export function useBookings(query: Partial<ListBookingsQuery> = {}) {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.bookings.list(query),
    queryFn: ({ pageParam }) =>
      api.bookings.list({ ...query, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useBooking(bookingId: string | undefined) {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.bookings.detail(bookingId ?? ''),
    queryFn: () => api.bookings.detail(bookingId as string),
    enabled: Boolean(bookingId),
  });
}

export function useCreateBooking() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBookingBody) => api.bookings.create(body),
    onSuccess: (booking) => {
      queryClient.setQueryData(queryKeys.bookings.detail(booking.id), booking);
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      // The date it just took is gone from the calendar now.
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.all });
    },
  });
}

export function useCancelBooking(bookingId: string) {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CancelBookingBody = {}) => api.bookings.cancel(bookingId, body),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.bookings.detail(bookingId), result.booking);
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
    },
  });
}

/* ── Payments ───────────────────────────────────────────────────────────── */

export function useCreatePaymentIntent() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePaymentIntentBody) => api.payments.createIntent(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

/**
 * Poll a payment until it settles.
 *
 * Providers redirect back before their webhook has landed, so the screen after
 * a redirect has to ask. Polling stops the moment the payment reaches a final
 * state, which is what keeps this from running forever on a forgotten tab.
 */
export function usePaymentStatus(paymentId: string | undefined, enabled = true) {
  const api = useZalApi();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payments', paymentId],
    queryFn: () => api.payments.status(paymentId as string),
    enabled: Boolean(paymentId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 2000 : false;
    },
  });

  /**
   * Settling a payment moves the booking on, so the booking has to be refetched
   * too. The realtime socket normally does this, but polling is what runs when
   * the socket is *not* connected — so without this the one path that exists
   * for a bad network would leave the guest looking at "awaiting deposit" on a
   * booking they had just paid for.
   */
  const settled = query.data?.payment.status;
  useEffect(() => {
    if (settled !== 'SUCCEEDED' && settled !== 'REFUNDED') return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.me.all });
  }, [settled, queryClient]);

  return query;
}

/**
 * Leave a review.
 *
 * The venue's rating is recomputed server-side from the rows, so the venue is
 * invalidated alongside the booking rather than nudged locally — a stale
 * average on the page the guest just contributed to is the one place it would
 * be noticed.
 */
export function useCreateReview(bookingId: string) {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Omit<CreateReviewBody, 'bookingId'>) => api.bookings.review(bookingId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
    },
  });
}

/* ── Favorites ──────────────────────────────────────────────────────────── */

export function useFavorites() {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.favorites.list(),
    queryFn: ({ pageParam }) => api.favorites.list(pageParam ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * Toggle a save, optimistically.
 *
 * A heart has to fill the instant it is tapped — waiting for a round trip makes
 * the app feel broken. Every cached venue carrying `isSaved` is patched at once
 * so the card, the detail page and the shortlist agree, and the snapshot taken
 * here is rolled back if the request fails.
 */
export function useToggleFavorite() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation<FavoriteState, Error, string, { previous: [unknown, unknown][] }>({
    mutationFn: (venueId: string) => api.favorites.toggle(venueId),

    onMutate: async (venueId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.venues.all });

      const previous = queryClient.getQueriesData({ queryKey: queryKeys.venues.all });
      queryClient.setQueriesData({ queryKey: queryKeys.venues.all }, (data: unknown) =>
        patchSavedFlag(data, venueId),
      );

      return { previous: previous as [unknown, unknown][] };
    },

    onError: (_error, _venueId, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key as readonly unknown[], data);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.all });
    },
  });
}

/** Walk a cached payload and flip `isSaved` on whichever venue objects it holds. */
function patchSavedFlag(data: unknown, venueId: string): unknown {
  if (Array.isArray(data)) return data.map((entry) => patchSavedFlag(entry, venueId));
  if (!data || typeof data !== 'object') return data;

  const record = data as Record<string, unknown>;

  if (record.id === venueId && 'isSaved' in record) {
    return { ...record, isSaved: !record.isSaved };
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const patched = patchSavedFlag(value, venueId);
    if (patched !== value) changed = true;
    next[key] = patched;
  }
  return changed ? next : data;
}

export function useIsSaved(venue: VenueSummary | undefined): boolean {
  return venue?.isSaved ?? false;
}

/* ── Notifications and messages ─────────────────────────────────────────── */

export function useNotifications(query: Partial<ListNotificationsQuery> = {}) {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(query),
    queryFn: ({ pageParam }) =>
      api.notifications.list({ ...query, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useUnreadCount() {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => api.notifications.unreadCount(),
    staleTime: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) => api.notifications.markRead(ids),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useConversations() {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.messages.conversations(),
    queryFn: ({ pageParam }) => api.messages.conversations(pageParam ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useThread(conversationId: string | undefined) {
  const api = useZalApi();

  return useInfiniteQuery({
    queryKey: queryKeys.messages.thread(conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      api.messages.messages(conversationId as string, pageParam ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage(conversationId: string) {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SendMessageBody) => api.messages.send(conversationId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread(conversationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.conversations() });
    },
  });
}

/* ── Account settings ───────────────────────────────────────────────────── */

/**
 * These exist so app code never imports React Query directly.
 *
 * That is not only tidiness. In a pnpm workspace each package resolves its own
 * copy of a dependency, and two copies of React Query mean two contexts: a
 * `useQuery` called from an app would look for a client that only ever existed
 * inside this package's copy, and fail with "No QueryClient set". Keeping every
 * hook here means there is one copy doing the work.
 */
export function useNotificationPreferences() {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.me.notificationPreferences(),
    queryFn: () => api.me.notificationPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateNotificationPreferencesBody) =>
      api.me.updateNotificationPreferences(body),
    onSuccess: (preferences) => {
      queryClient.setQueryData(queryKeys.me.notificationPreferences(), preferences);
    },
  });
}

export function usePaymentMethods() {
  const api = useZalApi();

  return useQuery({
    queryKey: queryKeys.me.paymentMethods(),
    queryFn: () => api.me.paymentMethods(),
  });
}

export function useRemovePaymentMethod() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (methodId: string) => api.me.removePaymentMethod(methodId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.paymentMethods() });
    },
  });
}

export function useBookingCalendarLinks() {
  const api = useZalApi();
  return useMutation({ mutationFn: (bookingId: string) => api.bookings.calendar(bookingId) });
}

export function useDeleteAccount() {
  const api = useZalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) => api.me.deleteAccount(reason),
    onSettled: () => queryClient.clear(),
  });
}
