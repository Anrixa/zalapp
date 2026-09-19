'use client';

import Link from 'next/link';
import { useBooking } from '@zal/api-client';
import { formatAmdPlain } from '@zal/contracts';
import { Spinner } from '@/components/ui';
import { CheckIcon } from '@/components/icons';
import { formatLongDate, formatShortDate, slotLabel } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

export default function ConfirmationPage({ params }: { params: { bookingId: string } }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const { data: booking, isLoading } = useBooking(params.bookingId);

  if (isLoading) return <Spinner />;
  if (!booking) return null;

  return (
    <main
      className="page"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}
    >
      <div
        className="grow stack"
        style={{ alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 88,
            height: 88,
            borderRadius: 999,
            background: 'var(--zal-sage-tint)',
            color: 'var(--zal-sage-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon size={40} />
        </div>

        <h1 className="display" style={{ fontSize: 27, marginTop: 22 }}>
          {t('Booking confirmed')}
        </h1>
        <p style={{ marginTop: 8, fontSize: 14.5, color: 'var(--zal-ink-soft)', lineHeight: 1.5 }}>
          {t('Your date at')} {booking.venue.name}{' '}
          {t('is locked in. A confirmation was sent to your phone.')}
        </p>

        <div className="card" style={{ marginTop: 26, width: '100%', textAlign: 'left' }}>
          <div className="spread">
            <span style={{ fontSize: 12, color: 'var(--zal-ink-muted)', fontWeight: 700 }}>
              {t('BOOKING REF')}
            </span>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>{booking.ref}</span>
          </div>

          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--zal-card-line)',
              margin: '14px 0',
            }}
          />

          <div className="display" style={{ fontSize: 17 }}>
            {booking.venue.name}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--zal-ink-soft)', marginTop: 4 }}>
            {formatLongDate(booking.eventDate, intlLocale)} · {t(slotLabel(booking.slot))}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--zal-ink-soft)' }}>
            {booking.guestCount} {t('guests')} · {booking.venue.district}, {booking.venue.city}
          </div>

          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--zal-card-line)',
              margin: '14px 0',
            }}
          />

          <div className="spread">
            <span style={{ fontSize: 13, color: 'var(--zal-ink-soft)' }}>{t('Paid today')}</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{formatAmdPlain(booking.paidAmd)}</span>
          </div>
          <div className="spread" style={{ marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--zal-ink-soft)' }}>
              {t('Balance due')} {formatShortDate(booking.balanceDueOn, intlLocale)}
            </span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {formatAmdPlain(booking.totalAmd - booking.paidAmd)}
            </span>
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 12, padding: '16px 24px 36px' }}>
        <Link href={`/bookings/${booking.id}`} className="btn btn--primary btn--block">
          {t('View booking')}
        </Link>
        <Link href="/" className="btn btn--secondary btn--block">
          {t('Back to home')}
        </Link>
      </div>
    </main>
  );
}
