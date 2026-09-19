'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useMarkNotificationsRead, useNotifications } from '@zal/api-client';
import type { Notification } from '@zal/contracts';
import { BottomNav } from '@/components/bottom-nav';
import { Button, EmptyState, ErrorNote } from '@/components/ui';
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  HallIcon,
  MessageIcon,
  StarIcon,
} from '@/components/icons';
import { formatRelative } from '@/lib/format';
import { useT } from '@/lib/i18n';

const ICONS: Record<Notification['type'], { Icon: typeof CheckIcon; bg: string; fg: string }> = {
  BOOKING_CONFIRMED: { Icon: CheckIcon, bg: 'var(--zal-sage-tint)', fg: 'var(--zal-sage-dark)' },
  BOOKING_DECLINED: { Icon: BellIcon, bg: 'var(--zal-pomegranate-tint)', fg: 'var(--zal-rust)' },
  BOOKING_CANCELLED: { Icon: BellIcon, bg: 'var(--zal-pomegranate-tint)', fg: 'var(--zal-rust)' },
  BALANCE_DUE: { Icon: ClockIcon, bg: 'var(--zal-apricot-tint)', fg: 'var(--zal-apricot-dark)' },
  PAYMENT_RECEIVED: { Icon: CheckIcon, bg: 'var(--zal-sage-tint)', fg: 'var(--zal-sage-dark)' },
  MESSAGE_RECEIVED: {
    Icon: MessageIcon,
    bg: 'var(--zal-pomegranate-tint)',
    fg: 'var(--zal-pomegranate)',
  },
  PRICE_DROP: { Icon: HallIcon, bg: 'var(--zal-sage-tint)', fg: 'var(--zal-sage-dark)' },
  REVIEW_PUBLISHED: { Icon: StarIcon, bg: 'var(--zal-ivory-2)', fg: 'var(--zal-ink-soft)' },
  EVENT_REMINDER: { Icon: ClockIcon, bg: 'var(--zal-apricot-tint)', fg: 'var(--zal-apricot-dark)' },
};

export default function NotificationsPage() {
  const t = useT();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];
  const unread = notifications.filter((notification) => notification.readAt === null);

  // Opening the tab is the act of reading. Marking them read on mount — rather
  // than making the guest press a button — is what the badge already implies.
  useEffect(() => {
    if (unread.length > 0 && !markRead.isPending) {
      markRead.mutate(unread.map((notification) => notification.id));
    }
    // Run once per batch of unread ids, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length]);

  return (
    <main className="page">
      <header className="spread section" style={{ paddingTop: 22 }}>
        <h1 className="display" style={{ fontSize: 24, margin: 0 }}>
          {t('Notifications')}
        </h1>
        {unread.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => markRead.mutate(undefined)}
          >
            {t('Mark all read')}
          </button>
        )}
      </header>

      <div style={{ marginTop: 18 }}>
        <ErrorNote error={error} />

        {isLoading &&
          [0, 1, 2].map((index) => (
            <div
              key={index}
              className="skeleton"
              style={{ height: 72, margin: '0 24px 10px' }}
              aria-hidden="true"
            />
          ))}

        {notifications.map((notification) => {
          const tone = ICONS[notification.type];
          const href = notification.data.bookingId
            ? `/bookings/${notification.data.bookingId}`
            : notification.data.venueId
              ? `/venues/${notification.data.venueId}`
              : '/notifications';

          return (
            <Link
              key={notification.id}
              href={href}
              className="row"
              style={{
                gap: 12,
                padding: '14px 24px',
                alignItems: 'flex-start',
                background: notification.readAt ? 'transparent' : '#FBF2E8',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tone.bg,
                  color: tone.fg,
                }}
              >
                <tone.Icon size={20} />
              </span>

              <span className="grow">
                <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.4 }}>
                  <strong>{notification.title}</strong> — {notification.body}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11.5,
                    color: 'var(--zal-ink-muted)',
                    marginTop: 4,
                  }}
                >
                  {formatRelative(notification.createdAt)}
                </span>
              </span>

              {!notification.readAt && (
                <span
                  aria-label="Unread"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: 'var(--zal-pomegranate)',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {!isLoading && notifications.length === 0 && !error && (
        <EmptyState
          title="Nothing yet"
          body="Confirmations, balance reminders and messages from hosts will land here."
        />
      )}

      {hasNextPage && (
        <div className="section" style={{ paddingTop: 16, paddingBottom: 24 }}>
          <Button
            variant="secondary"
            block
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t('Earlier')}
          </Button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
