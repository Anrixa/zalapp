'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBookings } from '@zal/api-client';
import { BookingBucket, formatAmdPlain } from '@zal/contracts';
import { BottomNav } from '@/components/bottom-nav';
import { Button, EmptyState, ErrorNote, StatusBadge } from '@/components/ui';
import { ChevronRight } from '@/components/icons';
import { formatShortDate, placeholderGradient, slotLabel } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

const TABS = [
  { bucket: BookingBucket.UPCOMING, label: 'Upcoming' },
  { bucket: BookingBucket.PAST, label: 'Past' },
  { bucket: BookingBucket.CANCELLED, label: 'Cancelled' },
] as const;

export default function BookingsPage() {
  const t = useT();
  const { intlLocale } = useLocale();
  const [bucket, setBucket] = useState<BookingBucket>(BookingBucket.UPCOMING);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useBookings({
    bucket,
  });

  const bookings = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="page">
      <header className="section" style={{ paddingTop: 22 }}>
        <h1 className="display" style={{ fontSize: 24, margin: 0 }}>
          {t('My bookings')}
        </h1>
      </header>

      <div
        className="row section"
        style={{ gap: 8, paddingTop: 16 }}
        role="tablist"
        aria-label={t('My bookings')}
      >
        {TABS.map((tab) => (
          <button
            key={tab.bucket}
            type="button"
            role="tab"
            aria-selected={bucket === tab.bucket}
            className="chip"
            onClick={() => setBucket(tab.bucket)}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <div className="stack section" style={{ gap: 14, paddingTop: 18 }}>
        <ErrorNote error={error} />

        {isLoading &&
          [0, 1].map((index) => (
            <div key={index} className="skeleton" style={{ height: 104 }} aria-hidden="true" />
          ))}

        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="row card"
            style={{ gap: 14 }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                flexShrink: 0,
                background: booking.venue.coverImage
                  ? `url(${booking.venue.coverImage.url}) center/cover`
                  : placeholderGradient(booking.venue.id),
              }}
            />

            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <StatusBadge status={booking.status} />
              </div>
              <div className="display" style={{ fontSize: 16 }}>
                {booking.venue.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--zal-ink-soft)', marginTop: 2 }}>
                {formatShortDate(booking.eventDate, intlLocale)} · {t(slotLabel(booking.slot))}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--zal-ink-muted)' }}>
                {booking.guestCount} {t('guests')} · {formatAmdPlain(booking.totalAmd)}
              </div>
            </div>

            <ChevronRight size={16} style={{ color: 'var(--zal-ink-muted)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>

      {!isLoading && bookings.length === 0 && !error && (
        <EmptyState
          title={
            bucket === BookingBucket.UPCOMING
              ? 'Nothing booked yet'
              : bucket === BookingBucket.PAST
                ? 'No past events'
                : 'Nothing cancelled'
          }
          body={
            bucket === BookingBucket.UPCOMING
              ? 'When you hold a date, it will show up here with the balance and the cancellation window.'
              : 'Bookings move here once the day has passed.'
          }
          action={
            bucket === BookingBucket.UPCOMING ? (
              <Link href="/search" className="btn btn--primary">
                {t('Search')}
              </Link>
            ) : undefined
          }
        />
      )}

      {hasNextPage && (
        <div className="section" style={{ paddingBottom: 24 }}>
          <Button
            variant="secondary"
            block
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t('See all')}
          </Button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
