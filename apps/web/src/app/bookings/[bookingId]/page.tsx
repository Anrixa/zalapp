'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useBooking,
  useBookingCalendarLinks,
  useCancelBooking,
  useCreateReview,
} from '@zal/api-client';
import { BookingStatus, SLOT_HOURS, formatAmdPlain } from '@zal/contracts';
import type { BookingDetail } from '@zal/contracts';
import { Avatar, Button, ErrorNote, ScreenHeader, Spinner, StatusBadge } from '@/components/ui';
import { CalendarIcon, MessageIcon, PinIcon } from '@/components/icons';
import { formatShortDate } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

export default function BookingDetailPage({ params }: { params: { bookingId: string } }) {
  const { bookingId } = params;
  const t = useT();
  const { intlLocale } = useLocale();
  const calendarLinks = useBookingCalendarLinks();

  const { data: booking, isLoading } = useBooking(bookingId);
  const cancelBooking = useCancelBooking(bookingId);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (isLoading) return <Spinner />;
  if (!booking) {
    return (
      <main className="page">
        <ScreenHeader title="Booking" backHref="/bookings" />
        <p className="form-error" style={{ margin: 24 }}>
          {t('We could not find that booking.')}
        </p>
      </main>
    );
  }

  const outstanding = booking.totalAmd - booking.paidAmd;
  const preview = booking.cancellationPreview;

  return (
    <main className="page">
      <ScreenHeader
        title={booking.venue.name}
        backHref="/bookings"
        action={<StatusBadge status={booking.status} />}
      />

      <section className="section" style={{ paddingTop: 16 }}>
        <div className="row" style={{ gap: 6, color: 'var(--zal-ink-soft)', fontSize: 13.5 }}>
          <PinIcon size={14} />
          <span>
            {booking.venue.district}, {booking.venue.city}
          </span>
        </div>

        <dl
          className="card"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            marginTop: 16,
          }}
        >
          <Fact label={t('DATE')} value={formatShortDate(booking.eventDate, intlLocale)} />
          <Fact
            label={t('TIME')}
            value={`${SLOT_HOURS[booking.slot].start}–${SLOT_HOURS[booking.slot].end}`}
          />
          <Fact label={t('GUESTS')} value={String(booking.guestCount)} />
          <Fact label={t('BOOKING REF')} value={booking.ref} />
        </dl>

        <p style={{ fontSize: 12.5, color: 'var(--zal-ink-muted)', marginTop: 8 }}>
          {t('Show this code at check-in')}
        </p>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <h2 className="section-title" style={{ fontSize: 18, marginBottom: 12 }}>
          {t('Payment')}
        </h2>

        <div className="card">
          {booking.quote.lines.map((line) => (
            <div key={line.key} className="spread" style={{ fontSize: 13.5, marginBottom: 8 }}>
              <span className="muted">{t(line.label)}</span>
              <span style={{ fontWeight: 600 }}>{formatAmdPlain(line.amountAmd)}</span>
            </div>
          ))}

          <div
            className="spread"
            style={{
              marginTop: 10,
              paddingTop: 12,
              borderTop: '1px solid var(--zal-card-line)',
              fontSize: 14.5,
            }}
          >
            <strong>{t('Total')}</strong>
            <strong>{formatAmdPlain(booking.totalAmd)}</strong>
          </div>

          <div className="spread" style={{ marginTop: 8, fontSize: 13.5 }}>
            <span className="muted">{t('Paid (deposit)')}</span>
            <span style={{ fontWeight: 700 }}>−{formatAmdPlain(booking.paidAmd)}</span>
          </div>

          {outstanding > 0 && (
            <div
              className="spread"
              style={{
                marginTop: 10,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--zal-apricot-tint)',
                color: '#8A5A16',
                fontSize: 13.5,
              }}
            >
              <strong>
                {t('Balance due')} {formatShortDate(booking.balanceDueOn, intlLocale)}
              </strong>
              <strong>{formatAmdPlain(outstanding)}</strong>
            </div>
          )}
        </div>

        {outstanding > 0 && booking.status === 'CONFIRMED' && (
          <Link
            href={`/bookings/${booking.id}/payment`}
            className="btn btn--primary btn--block"
            style={{ marginTop: 14 }}
          >
            {t('Pay')} {formatAmdPlain(outstanding)}
          </Link>
        )}
      </section>

      <section className="section row" style={{ paddingTop: 24, gap: 12 }}>
        <Avatar name={booking.host.displayName} size={48} />
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {t('Hosted by')} {booking.host.displayName}
          </div>
        </div>
        <Link
          href={`/messages/new?venueId=${booking.venue.id}&bookingId=${booking.id}`}
          className="icon-btn"
          aria-label={`Message ${booking.host.displayName}`}
        >
          <MessageIcon size={19} />
        </Link>
      </section>

      <section className="section stack" style={{ paddingTop: 24, gap: 12 }}>
        <a
          className="btn btn--secondary btn--block"
          href={`https://maps.google.com/?q=${encodeURIComponent(
            `${booking.venue.name}, ${booking.venue.district}, ${booking.venue.city}`,
          )}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          <PinIcon size={17} />
          {t('Get directions')}
        </a>

        <Button
          variant="secondary"
          block
          loading={calendarLinks.isPending}
          onClick={() =>
            calendarLinks.mutate(booking.id, {
              onSuccess: (links) => window.open(links.google, '_blank', 'noopener'),
            })
          }
        >
          <CalendarIcon size={17} />
          {t('Add to calendar')}
        </Button>
      </section>

      {booking.status === BookingStatus.COMPLETED && !booking.hasReview && (
        <ReviewForm booking={booking} />
      )}

      {preview && (
        <section className="section" style={{ paddingTop: 24, paddingBottom: 40 }}>
          <ErrorNote error={cancelBooking.error} />

          {!confirmingCancel ? (
            <Button variant="danger" block onClick={() => setConfirmingCancel(true)}>
              {t('Cancel this booking')}
            </Button>
          ) : (
            <div className="card" role="alertdialog" aria-label={t('Cancel this booking')}>
              <h2 className="section-title" style={{ fontSize: 16 }}>
                {t('Cancel this booking')}?
              </h2>

              {/*
                The refund is stated before the guest commits, in money rather
                than in policy language. "The deposit is non-refundable" is not
                the same as being shown the number you lose.
              */}
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--zal-ink-body)' }}>
                {preview.isFree
                  ? `You are inside the free-cancellation window — ${formatAmdPlain(preview.refundAmd)} comes back to you in full.`
                  : `The free-cancellation window closed on ${formatShortDate(preview.freeCancellationUntil, intlLocale)}. You would forfeit ${formatAmdPlain(preview.forfeitedAmd)} and get ${formatAmdPlain(preview.refundAmd)} back.`}
              </p>

              <div className="row" style={{ gap: 12, marginTop: 8 }}>
                <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
                  Keep it
                </Button>
                <Button
                  variant="danger"
                  block
                  loading={cancelBooking.isPending}
                  onClick={() =>
                    cancelBooking.mutate({}, { onSuccess: () => setConfirmingCancel(false) })
                  }
                >
                  {t('Cancel this booking')}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 11, fontWeight: 700, color: 'var(--zal-ink-muted)' }}>{label}</dt>
      <dd style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 15 }}>{value}</dd>
    </div>
  );
}

/**
 * Leaving a review.
 *
 * Offered only on a completed booking that has not been reviewed — the server
 * enforces both, and showing a form it would refuse is a worse answer than not
 * showing one. The rating is a radio group rather than five buttons so that it
 * is a single tab stop and announces itself as a choice of five.
 */
function ReviewForm({ booking }: { booking: BookingDetail }) {
  const t = useT();
  const createReview = useCreateReview(booking.id);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  if (createReview.isSuccess) {
    return (
      <section className="section" style={{ paddingTop: 24 }}>
        <p className="card" style={{ margin: 0, color: 'var(--zal-ink-soft)', fontSize: 14 }}>
          {t('Thanks — your review is live.')}
        </p>
      </section>
    );
  }

  return (
    <section className="section" style={{ paddingTop: 24 }}>
      <h2 className="section-title" style={{ marginBottom: 12 }}>
        {t('How was it?')}
      </h2>

      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          if (rating === 0) return;
          createReview.mutate({ rating, ...(body.trim() ? { body: body.trim() } : {}) });
        }}
      >
        <ErrorNote error={createReview.error} />

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="sr-only">{t('Your rating')}</legend>
          <div className="row" style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <label
                key={value}
                className="icon-btn"
                style={{
                  cursor: 'pointer',
                  background: value <= rating ? 'var(--zal-apricot-tint)' : 'var(--zal-white)',
                  border: '1px solid var(--zal-card-line)',
                  color: value <= rating ? 'var(--zal-apricot-dark)' : 'var(--zal-ink-muted)',
                  fontWeight: 700,
                }}
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="sr-only"
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="review-body" className="label" style={{ marginTop: 16, display: 'block' }}>
          {t('Add anything else?')} <span className="muted">{t('(optional)')}</span>
        </label>
        <textarea
          id="review-body"
          value={body}
          maxLength={2000}
          rows={4}
          onChange={(event) => setBody(event.target.value)}
          style={{ width: '100%', marginTop: 6 }}
        />

        <Button type="submit" block disabled={rating === 0} loading={createReview.isPending}>
          {t('Post review')}
        </Button>
      </form>
    </section>
  );
}
