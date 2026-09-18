import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_NAMESPACE, RealtimeEvent, type RealtimePayloadMap } from '@zal/contracts';
import { useZal } from './provider';
import { queryKeys } from './query-keys';

export interface RealtimeOptions {
  /** Origin only — the namespace is appended here. */
  url: string;
  enabled?: boolean;
}

/**
 * Keep the app in step with the server.
 *
 * The socket carries *what changed*, and this hook turns that into a React
 * Query invalidation. Nothing here merges a payload into cached state, which is
 * the whole point: a screen can never end up holding a half-updated booking,
 * and a client that was backgrounded through three events is corrected by the
 * refetch its next render triggers anyway.
 *
 * Reconnection re-authenticates with whatever access token is current, so a
 * socket dropped across a token refresh comes back authenticated rather than
 * silently anonymous.
 */
export function useRealtime(options: RealtimeOptions): void {
  const { client, ready } = useZal();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!ready || options.enabled === false) return;

    let disposed = false;
    let socket: Socket | null = null;

    void (async () => {
      const token = await client.storage.getAccessToken();
      if (!token || disposed) return;

      socket = io(`${options.url}${REALTIME_NAMESPACE}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10_000,
      });
      socketRef.current = socket;

      // Re-read the token on every reconnect: the one captured above may have
      // expired while the connection was down.
      socket.io.on('reconnect_attempt', () => {
        void Promise.resolve(client.storage.getAccessToken()).then((fresh) => {
          if (socket && fresh) socket.auth = { token: fresh };
        });
      });

      socket.on(RealtimeEvent.BOOKING_UPDATED, (payload: RealtimePayloadMap['booking.updated']) => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.detail(payload.bookingId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.venues.detail(payload.venueId),
        });
      });

      socket.on(RealtimeEvent.PAYMENT_UPDATED, (payload: RealtimePayloadMap['payment.updated']) => {
        void queryClient.invalidateQueries({ queryKey: ['payments', payload.paymentId] });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.detail(payload.bookingId),
        });
      });

      socket.on(
        RealtimeEvent.NOTIFICATION_CREATED,
        (payload: RealtimePayloadMap['notification.created']) => {
          // The unread badge is set from the payload — it is a single number and
          // waiting a round trip for it makes the badge feel laggy.
          queryClient.setQueryData(queryKeys.notifications.unreadCount(), {
            unread: payload.unread,
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
        },
      );

      socket.on(RealtimeEvent.MESSAGE_CREATED, (payload: RealtimePayloadMap['message.created']) => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.messages.thread(payload.conversationId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages.conversations() });
      });

      socket.on(
        RealtimeEvent.UNREAD_COUNT,
        (payload: RealtimePayloadMap['notification.unread']) => {
          queryClient.setQueryData(queryKeys.notifications.unreadCount(), payload);
        },
      );
    })();

    return () => {
      disposed = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [client, queryClient, ready, options.url, options.enabled]);
}
