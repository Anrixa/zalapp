'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking, useCreatePaymentIntent, usePaymentStatus } from '@zal/api-client';
import { PaymentProvider, cardInputSchema, formatAmdPlain } from '@zal/contracts';
import { Button, ErrorNote, ScreenHeader, Spinner } from '@/components/ui';
import { CardIcon } from '@/components/icons';
import { useT } from '@/lib/i18n';

const METHODS = [
  {
    provider: PaymentProvider.CARD,
    title: 'Debit / credit card',
    subtitle: 'Visa, Mastercard, ArCa',
  },
  { provider: PaymentProvider.IDRAM, title: 'Idram', subtitle: 'Pay from your Idram wallet' },
  { provider: PaymentProvider.TELCELL, title: 'Telcell Wallet', subtitle: 'Pay by phone number' },
  {
    provider: PaymentProvider.BANK_TRANSFER,
    title: 'Bank transfer',
    subtitle: 'Manual confirmation, 1–2 days',
  },
] as const;

/**
 * Step 3 of 3 — payment.
 *
 * Card fields are validated here (Luhn included, from the shared contract) but
 * never sent to Zal: in production the provider's SDK tokenises them in the
 * browser and only the token travels. The API is asked for an intent, and what
 * comes back decides what happens next — a redirect for 3-D Secure and the
 * wallets, bank details to copy for a transfer, or an immediate settle in
 * development.
 */
export default function PaymentPage({ params }: { params: { bookingId: string } }) {
  const { bookingId } = params;
  const router = useRouter();
  const t = useT();

  const { data: booking, isLoading } = useBooking(bookingId);
  const createIntent = useCreatePaymentIntent();
  const [provider, setProvider] = useState<PaymentProvider>(PaymentProvider.CARD);
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', holder: '' });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const { data: status } = usePaymentStatus(paymentId ?? undefined, Boolean(paymentId));

  // The webhook is what makes a payment real; when it lands, move on.
  useEffect(() => {
    if (status?.payment.status === 'SUCCEEDED') {
      router.replace(`/bookings/${bookingId}/confirmed`);
    }
  }, [status?.payment.status, bookingId, router]);

  if (isLoading) return <Spinner />;
  if (!booking) {
    return (
      <main className="page">
        <ScreenHeader title={t('Payment')} backHref="/bookings" />
        <p className="form-error" style={{ margin: 24 }}>
          We could not find that booking.
        </p>
      </main>
    );
  }

  const amount = booking.paidAmd >= booking.depositAmd ? booking.balanceAmd : booking.depositAmd;
  const kind = booking.paidAmd >= booking.depositAmd ? 'BALANCE' : 'DEPOSIT';

  function pay() {
    if (provider === PaymentProvider.CARD) {
      const parsed = cardInputSchema.safeParse(card);
      if (!parsed.success) {
        setCardErrors(
          Object.fromEntries(
            parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
          ),
        );
        return;
      }
      setCardErrors({});
    }

    createIntent.mutate(
      {
        bookingId,
        kind,
        provider,
        savePaymentMethod: false,
        returnUrl:
          typeof window === 'undefined'
            ? undefined
            : `${window.location.origin}/bookings/${bookingId}/payment`,
        idempotencyKey: `${bookingId}:${kind}:${provider}`,
      },
      {
        onSuccess: (intent) => {
          setPaymentId(intent.paymentId);
          if (intent.redirectUrl) {
            window.location.href = intent.redirectUrl;
            return;
          }
          if (intent.status === 'SUCCEEDED') {
            router.replace(`/bookings/${bookingId}/confirmed`);
          }
        },
      },
    );
  }

  const intent = createIntent.data;

  return (
    <main className="page">
      <ScreenHeader
        title={t('Payment')}
        step={t('STEP 3 OF 3')}
        backHref={`/bookings/${bookingId}`}
      />

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="stack" style={{ gap: 10 }} role="radiogroup" aria-label={t('Payment')}>
          {METHODS.map((method) => (
            <button
              key={method.provider}
              type="button"
              role="radio"
              aria-checked={provider === method.provider}
              onClick={() => setProvider(method.provider)}
              className="row card"
              style={{
                gap: 12,
                padding: 16,
                textAlign: 'left',
                borderColor:
                  provider === method.provider ? 'var(--zal-pomegranate)' : 'var(--zal-card-line)',
                borderWidth: provider === method.provider ? 1.5 : 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  flexShrink: 0,
                  border: `2px solid ${provider === method.provider ? 'var(--zal-pomegranate)' : 'var(--zal-line)'}`,
                  background:
                    provider === method.provider
                      ? 'radial-gradient(circle, var(--zal-pomegranate) 0 4px, transparent 5px)'
                      : 'transparent',
                }}
              />
              <span className="grow">
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>
                  {t(method.title)}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--zal-ink-soft)' }}>
                  {t(method.subtitle)}
                </span>
              </span>
              {method.provider === PaymentProvider.CARD && <CardIcon size={20} />}
            </button>
          ))}
        </div>
      </section>

      {provider === PaymentProvider.CARD && (
        <section className="section" style={{ paddingTop: 24 }}>
          <label className="field">
            <span>{t('Card number')}</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={card.number}
              aria-invalid={Boolean(cardErrors.number)}
              aria-describedby={cardErrors.number ? 'card-number-error' : undefined}
              onChange={(event) => setCard({ ...card, number: event.target.value })}
            />
            {cardErrors.number && (
              <span className="field-error" id="card-number-error">
                {cardErrors.number}
              </span>
            )}
          </label>

          <div className="row" style={{ gap: 12 }}>
            <label className="field grow">
              <span>{t('Expiry')}</span>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder={t('MM / YY')}
                value={card.expiry}
                aria-invalid={Boolean(cardErrors.expiry)}
                onChange={(event) => setCard({ ...card, expiry: event.target.value })}
              />
              {cardErrors.expiry && <span className="field-error">{cardErrors.expiry}</span>}
            </label>

            <label className="field grow">
              <span>{t('CVC')}</span>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="•••"
                value={card.cvc}
                aria-invalid={Boolean(cardErrors.cvc)}
                onChange={(event) => setCard({ ...card, cvc: event.target.value })}
              />
              {cardErrors.cvc && <span className="field-error">{cardErrors.cvc}</span>}
            </label>
          </div>

          <label className="field">
            <span>{t('Name on card')}</span>
            <input
              className="input"
              autoComplete="cc-name"
              placeholder="ANI SARGSYAN"
              value={card.holder}
              aria-invalid={Boolean(cardErrors.holder)}
              onChange={(event) => setCard({ ...card, holder: event.target.value })}
            />
            {cardErrors.holder && <span className="field-error">{cardErrors.holder}</span>}
          </label>
        </section>
      )}

      {intent?.bankTransfer && (
        <section className="section" style={{ paddingTop: 8 }}>
          <div className="card">
            <h2 className="section-title" style={{ fontSize: 16, marginBottom: 10 }}>
              {t('Bank transfer')}
            </h2>
            <Row label="Beneficiary" value={intent.bankTransfer.beneficiary} />
            <Row label="IBAN" value={intent.bankTransfer.iban} />
            <Row label="Bank" value={intent.bankTransfer.bank} />
            <Row label="Reference" value={intent.bankTransfer.reference} />
            <p style={{ fontSize: 12.5, color: 'var(--zal-ink-soft)', marginTop: 12 }}>
              {intent.bankTransfer.note}
            </p>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 20 }}>
        <ErrorNote error={createIntent.error} />
        <p style={{ fontSize: 12.5, color: 'var(--zal-ink-soft)', lineHeight: 1.5 }}>
          {t('Payments are encrypted end-to-end. Zal never stores your full card number.')}
        </p>
      </section>

      <div className="sticky-bar">
        <Button block loading={createIntent.isPending} onClick={pay}>
          {kind === 'DEPOSIT'
            ? `${t('Pay')} ${formatAmdPlain(amount)} ${t('deposit')}`
            : `${t('Pay')} ${formatAmdPlain(amount)}`}
        </Button>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="spread" style={{ fontSize: 13.5, marginBottom: 8 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
