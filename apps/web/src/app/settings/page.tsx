'use client';

import {
  useMe,
  useNotificationPreferences,
  usePaymentMethods,
  useUpdateNotificationPreferences,
  useUpdateProfile,
} from '@zal/api-client';
import { Currency, Locale } from '@zal/contracts';
import { LOCALE_NAMES } from '@zal/i18n';
import { ErrorNote, ScreenHeader, Spinner } from '@/components/ui';
import { ChevronRight } from '@/components/icons';
import { useLocale, useT } from '@/lib/i18n';

export default function SettingsPage() {
  const t = useT();
  const { locale, setLocale } = useLocale();

  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const { data: methods } = usePaymentMethods();

  if (isLoading) return <Spinner />;
  if (!me) return null;

  return (
    <main className="page">
      <ScreenHeader title={t('Settings')} backHref="/profile" />

      <ErrorNote error={updateProfile.error ?? updatePreferences.error} />

      <Group title={t('Account')}>
        <Row label={t('Name')} value={me.fullName} />
        <Row label={t('Phone')} value={me.phone} />
        <Row label={t('Email')} value={me.email ?? '—'} />
      </Group>

      <section id="language" style={{ marginTop: 26 }}>
        <h2 className="eyebrow" style={{ margin: '0 24px 10px' }}>
          {t('Language')}
        </h2>
        <div className="row section" style={{ gap: 10 }}>
          {(Object.keys(LOCALE_NAMES) as Locale[]).map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={locale === option}
              onClick={() => {
                // Switch the interface immediately, then persist it. Nobody
                // should wait on a round trip to read their own language.
                setLocale(option);
                updateProfile.mutate({ locale: option });
              }}
            >
              {LOCALE_NAMES[option]}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 26 }}>
        <h2 className="eyebrow" style={{ margin: '0 24px 10px' }}>
          {t('Currency')}
        </h2>
        <div className="row section" style={{ gap: 10 }}>
          {(
            [
              [Currency.AMD, 'AMD ֏'],
              [Currency.USD, 'USD $'],
              [Currency.EUR, 'EUR €'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={me.currency === value}
              onClick={() => updateProfile.mutate({ currency: value })}
            >
              {label}
            </button>
          ))}
        </div>
        {me.currency !== Currency.AMD && (
          <p style={{ fontSize: 12, color: 'var(--zal-ink-muted)', margin: '10px 24px 0' }}>
            Prices are charged in AMD. Other currencies are shown as an approximate guide.
          </p>
        )}
      </section>

      <section id="notifications" style={{ marginTop: 26 }}>
        <h2 className="eyebrow" style={{ margin: '0 24px 10px' }}>
          {t('Notifications')}
        </h2>
        <div className="card" style={{ margin: '0 24px', padding: 0, overflow: 'hidden' }}>
          {(
            [
              ['push', t('Push notifications')],
              ['sms', t('SMS reminders')],
              ['email', t('Email updates')],
              ['priceDrops', t('Price drop alerts')],
            ] as const
          ).map(([key, label], index) => (
            <label
              key={key}
              className="spread"
              style={{
                padding: '14px 18px',
                borderTop: index === 0 ? 'none' : '1px solid var(--zal-card-line)',
                cursor: 'pointer',
                minHeight: 52,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences?.[key] ?? false}
                onChange={(event) => updatePreferences.mutate({ [key]: event.target.checked })}
                style={{ width: 44, height: 26, accentColor: 'var(--zal-pomegranate)' }}
              />
            </label>
          ))}
        </div>
      </section>

      <section id="payment" style={{ marginTop: 26 }}>
        <h2 className="eyebrow" style={{ margin: '0 24px 10px' }}>
          {t('Payment methods')}
        </h2>
        <div className="card" style={{ margin: '0 24px', padding: 0, overflow: 'hidden' }}>
          {(methods ?? []).map((method, index) => (
            <div
              key={method.id}
              className="row"
              style={{
                gap: 12,
                padding: '14px 18px',
                borderTop: index === 0 ? 'none' : '1px solid var(--zal-card-line)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 24,
                  borderRadius: 5,
                  background: 'var(--zal-ink)',
                  color: 'var(--zal-ivory)',
                  fontSize: 9,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {method.brand.slice(0, 4).toUpperCase()}
              </span>
              <span className="grow" style={{ fontWeight: 600, fontSize: 13.5 }}>
                •••• {method.last4 ?? '––––'}
              </span>
              {method.isDefault && (
                <span style={{ fontSize: 11.5, color: 'var(--zal-ink-muted)', fontWeight: 700 }}>
                  {t('DEFAULT')}
                </span>
              )}
            </div>
          ))}

          {(methods ?? []).length === 0 && (
            <p
              style={{
                padding: '14px 18px',
                margin: 0,
                fontSize: 13.5,
                color: 'var(--zal-ink-soft)',
              }}
            >
              No card saved yet. You can add one at checkout.
            </p>
          )}
        </div>
      </section>

      <section style={{ marginTop: 26, paddingBottom: 40 }}>
        <div className="card" style={{ margin: '0 24px', padding: 0, overflow: 'hidden' }}>
          <LinkRow label={t('Privacy policy')} />
          <LinkRow label={t('Terms of service')} />
          <button
            type="button"
            className="row"
            style={{
              width: '100%',
              padding: '14px 18px',
              minHeight: 52,
              borderTop: '1px solid var(--zal-card-line)',
              color: 'var(--zal-rust)',
              fontWeight: 700,
              fontSize: 13.5,
            }}
          >
            {t('Delete account')}
          </button>
        </div>
      </section>
    </main>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="eyebrow" style={{ margin: '0 24px 10px' }}>
        {title}
      </h2>
      <div className="card" style={{ margin: '0 24px', padding: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="spread"
      style={{ padding: '14px 18px', borderTop: '1px solid var(--zal-card-line)', minHeight: 52 }}
    >
      <span style={{ color: 'var(--zal-ink-soft)', fontSize: 13.5 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{value}</span>
    </div>
  );
}

function LinkRow({ label }: { label: string }) {
  return (
    <a
      href="#"
      className="spread"
      style={{ padding: '14px 18px', borderTop: '1px solid var(--zal-card-line)', minHeight: 52 }}
    >
      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</span>
      <ChevronRight size={15} style={{ color: 'var(--zal-ink-muted)' }} />
    </a>
  );
}
