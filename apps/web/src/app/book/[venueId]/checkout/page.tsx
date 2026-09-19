'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCreateBooking, useQuote, useVenue, ZalApiError } from '@zal/api-client';
import { EventType, TimeSlot, formatAmdPlain, type QuoteRequestBody } from '@zal/contracts';
import { Button, ErrorNote, ScreenHeader, Spinner } from '@/components/ui';
import { CheckIcon } from '@/components/icons';
import { formatShortDate, slotLabel } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

export default function CheckoutPage({ params }: { params: { venueId: string } }) {
  return (
    <Suspense fallback={<Spinner />}>
      <CheckoutScreen venueId={params.venueId} />
    </Suspense>
  );
}

/**
 * Step 2 of 3 — review and pay.
 *
 * The price shown here comes from the server's `quote` endpoint, not from
 * adding numbers up in the browser: a date-specific price or a promo is
 * reflected without this screen knowing either rule exists. When the guest
 * commits, `expectedTotalAmd` is sent along so that a price which moved while
 * they were deciding is refused loudly rather than charged quietly.
 */
function CheckoutScreen({ venueId }: { venueId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const t = useT();
  const { intlLocale } = useLocale();

  const date = search.get('date') ?? '';
  const slot = (search.get('slot') as TimeSlot) ?? TimeSlot.EVENING;
  const guests = Number(search.get('guests') ?? 0);

  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [eventType, setEventType] = useState<EventType>(EventType.WEDDING);

  const { data: venue, isLoading: venueLoading } = useVenue(venueId);
  const createBooking = useCreateBooking();

  const quoteInput = useMemo<QuoteRequestBody | null>(
    () =>
      date && guests > 0
        ? { date, slot, guestCount: guests, addOnIds, ...(promoCode ? { promoCode } : {}) }
        : null,
    [date, slot, guests, addOnIds, promoCode],
  );

  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuote(venueId, quoteInput);

  if (venueLoading) return <Spinner />;

  if (!venue || !date || !guests) {
    return (
      <main className="page">
        <ScreenHeader title={t('Review & pay')} backHref={`/book/${venueId}`} />
        <p className="form-error" style={{ margin: 24 }}>
          {t('Pick a date to continue')}
        </p>
      </main>
    );
  }

  const conflict =
    createBooking.error instanceof ZalApiError &&
    (createBooking.error.code === 'SLOT_UNAVAILABLE' || createBooking.error.code === 'CONFLICT');

  return (
    <main className="page">
      <ScreenHeader
        title={t('Review & pay')}
        step={t('STEP 2 OF 3')}
        backHref={`/book/${venueId}?date=${date}&slot=${slot}&guests=${guests}`}
      />

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="card spread" style={{ gap: 12 }}>
          <div>
            <div className="display" style={{ fontSize: 17 }}>
              {venue.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--zal-ink-soft)', marginTop: 4 }}>
              {formatShortDate(date, intlLocale)} · {t(slotLabel(slot))} · {guests} {t('guests')}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() =>
              router.push(`/book/${venueId}?date=${date}&slot=${slot}&guests=${guests}`)
            }
          >
            {t('Edit details')}
          </button>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <h2 className="section-title" style={{ fontSize: 18, marginBottom: 12 }}>
          {t('What are you celebrating?')}
        </h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              [EventType.WEDDING, 'Wedding'],
              [EventType.BAPTISM, 'Baptism'],
              [EventType.BIRTHDAY, 'Birthday'],
              [EventType.ANNIVERSARY, 'Anniversary'],
              [EventType.CORPORATE, 'Corporate'],
              [EventType.OTHER, 'Other'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={eventType === value}
              onClick={() => setEventType(value)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </section>

      {venue.addOns.length > 0 && (
        <section className="section" style={{ paddingTop: 24 }}>
          <h2 className="section-title" style={{ fontSize: 18, marginBottom: 12 }}>
            {t('Add anything else?')}
          </h2>

          <div className="stack" style={{ gap: 10 }}>
            {venue.addOns.map((addOn) => {
              const checked = addOnIds.includes(addOn.id);

              return (
                <label
                  key={addOn.id}
                  className="row card"
                  style={{
                    gap: 12,
                    padding: 14,
                    cursor: 'pointer',
                    borderColor: checked ? 'var(--zal-pomegranate)' : 'var(--zal-card-line)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() =>
                      setAddOnIds((current) =>
                        checked ? current.filter((id) => id !== addOn.id) : [...current, addOn.id],
                      )
                    }
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: checked ? 'var(--zal-pomegranate)' : 'transparent',
                      border: checked ? 'none' : '1.5px solid var(--zal-line)',
                      color: 'var(--zal-ivory)',
                    }}
                  >
                    {checked && <CheckIcon size={13} />}
                  </span>

                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>
                      {t(addOn.name)}
                    </span>
                    {addOn.description && (
                      <span
                        style={{ display: 'block', fontSize: 12.5, color: 'var(--zal-ink-soft)' }}
                      >
                        {t(addOn.description)}
                      </span>
                    )}
                  </span>

                  <span style={{ fontWeight: 800, fontSize: 14 }}>
                    +{addOn.priceAmd.toLocaleString(intlLocale)}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 24 }}>
        <form
          className="row"
          style={{ gap: 10 }}
          onSubmit={(event) => {
            event.preventDefault();
            setPromoCode(promoInput.trim() ? promoInput.trim().toUpperCase() : undefined);
          }}
        >
          <label className="grow">
            <span className="sr-only">{t('Promo code')}</span>
            <input
              className="input"
              placeholder={t('Promo code')}
              value={promoInput}
              onChange={(event) => setPromoInput(event.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary">
            {t('Apply')}
          </Button>
        </form>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <h2 className="section-title" style={{ fontSize: 18, marginBottom: 12 }}>
          {t('Price details')}
        </h2>

        {quoteLoading && <div className="skeleton" style={{ height: 160 }} aria-hidden="true" />}
        <ErrorNote error={quoteError} />

        {quote && (
          <div className="card">
            {quote.lines.map((line) => (
              <div key={line.key} className="spread" style={{ marginBottom: 10, fontSize: 14 }}>
                <span className="muted">{t(line.label)}</span>
                <span style={{ fontWeight: 600 }}>{formatAmdPlain(line.amountAmd)}</span>
              </div>
            ))}

            <div
              className="spread"
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--zal-card-line)',
                fontSize: 15,
              }}
            >
              <strong>{t('Total')}</strong>
              <strong>{formatAmdPlain(quote.totalAmd)}</strong>
            </div>

            <div
              className="spread"
              style={{
                marginTop: 10,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--zal-apricot-tint)',
                color: '#8A5A16',
                fontSize: 14,
              }}
            >
              <strong>{t('Due today (20% deposit)')}</strong>
              <strong>{formatAmdPlain(quote.depositAmd)}</strong>
            </div>

            <p
              style={{
                fontSize: 12.5,
                color: 'var(--zal-ink-soft)',
                margin: '14px 0 0',
                lineHeight: 1.5,
              }}
            >
              {t(
                'Free cancellation up to 14 days before your event. After that, the deposit is non-refundable.',
              )}
            </p>
          </div>
        )}

        {quote && !quote.available && (
          <p className="form-error" role="alert" style={{ marginTop: 16 }}>
            {t('That date has just been taken — pick another one')}
          </p>
        )}
      </section>

      <div className="sticky-bar" style={{ marginTop: 28 }}>
        <div className="grow">
          {conflict && (
            <p className="field-error" role="alert" style={{ marginBottom: 6 }}>
              {(createBooking.error as ZalApiError).message}
            </p>
          )}
          <Button
            block
            loading={createBooking.isPending}
            disabled={!quote || !quote.available}
            onClick={() => {
              if (!quote) return;
              createBooking.mutate(
                {
                  venueId,
                  date,
                  slot,
                  guestCount: guests,
                  eventType,
                  addOnIds,
                  ...(promoCode ? { promoCode } : {}),
                  expectedTotalAmd: quote.totalAmd,
                  // Survives a double tap on a slow connection: the same key
                  // returns the booking already created rather than a second one.
                  idempotencyKey: `${venueId}:${date}:${slot}:${guests}:${addOnIds.join(',')}`,
                },
                { onSuccess: (booking) => router.push(`/bookings/${booking.id}/payment`) },
              );
            }}
          >
            {t('Continue to payment')}
          </Button>
        </div>
      </div>
    </main>
  );
}
