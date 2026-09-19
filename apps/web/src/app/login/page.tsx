'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ZalApiError, useLogin, useRequestOtp } from '@zal/api-client';
import { Button, ErrorNote } from '@/components/ui';
import { ChevronLeft, GoogleMark, ZalMark } from '@/components/icons';
import { useT } from '@/lib/i18n';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <LoginScreen />
    </Suspense>
  );
}

/**
 * Two ways in, on one screen.
 *
 * Password is the default because it is one step; "send me a code instead" is
 * one tap away for the many people who never set a password because they signed
 * up by phone. Both land in the same place.
 */
function LoginScreen() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const login = useLogin();
  const requestOtp = useRequestOtp();

  const error = login.error ?? requestOtp.error;
  const fieldError = (path: string) =>
    error instanceof ZalApiError ? error.fieldError(path) : undefined;

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
      <div style={{ padding: '20px 24px 0' }}>
        <Link href="/" className="icon-btn" aria-label={t('Back to home')}>
          <ChevronLeft size={18} />
        </Link>
      </div>

      <div className="grow section" style={{ paddingTop: 24 }}>
        <ZalMark size={44} />
        <h1 className="display" style={{ fontSize: 28, marginTop: 18 }}>
          {t('Welcome back')}
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--zal-ink-soft)' }}>
          {t('Log in to manage your bookings.')}
        </p>

        <form
          style={{ marginTop: 26 }}
          onSubmit={(event) => {
            event.preventDefault();

            if (mode === 'otp') {
              requestOtp.mutate(identifier.trim(), {
                onSuccess: (challenge) =>
                  router.push(
                    `/verify?verificationId=${challenge.verificationId}&hint=${encodeURIComponent(
                      challenge.phoneHint,
                    )}&next=${encodeURIComponent(next)}`,
                  ),
              });
              return;
            }

            login.mutate(
              { identifier: identifier.trim(), password },
              { onSuccess: () => router.replace(next) },
            );
          }}
        >
          <ErrorNote error={error} />

          <label className="field">
            <span>{t('Phone or email')}</span>
            <input
              className="input"
              autoComplete="username"
              inputMode="email"
              placeholder="+374 77 123 456"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-invalid={Boolean(fieldError('identifier') ?? fieldError('phone'))}
              required
            />
            {fieldError('identifier') && (
              <span className="field-error">{fieldError('identifier')}</span>
            )}
          </label>

          {mode === 'password' && (
            <>
              <label className="field">
                <span>{t('Password')}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('Your password')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              <div style={{ textAlign: 'right' }}>
                <Link href="/forgot-password" className="btn btn--ghost" style={{ fontSize: 13.5 }}>
                  {t('Forgot password?')}
                </Link>
              </div>
            </>
          )}

          <Button
            type="submit"
            block
            style={{ marginTop: 16 }}
            loading={login.isPending || requestOtp.isPending}
          >
            {mode === 'password' ? t('Log in') : t('Send me a code')}
          </Button>

          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 8 }}
            onClick={() => setMode(mode === 'password' ? 'otp' : 'password')}
          >
            {mode === 'password' ? t('Send me a code instead') : t('Use my password instead')}
          </button>
        </form>
      </div>

      <div className="stack" style={{ gap: 14, padding: '16px 24px 32px' }}>
        <div
          className="row"
          style={{ gap: 10, color: 'var(--zal-ink-muted)', fontSize: 12, fontWeight: 600 }}
        >
          <span className="grow" style={{ height: 1, background: 'var(--zal-line)' }} />
          OR
          <span className="grow" style={{ height: 1, background: 'var(--zal-line)' }} />
        </div>

        {/*
          Google sign-in needs the browser SDK and a client id, which are set
          per environment. The button is disabled rather than hidden so its
          absence is visibly a configuration gap, not a missing feature.
        */}
        <Button variant="secondary" block disabled title="Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID">
          <GoogleMark />
          {t('Continue with Google')}
        </Button>

        <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--zal-ink-soft)' }}>
          {t('New to Zal?')}{' '}
          <Link href="/signup" style={{ color: 'var(--zal-pomegranate)', fontWeight: 700 }}>
            {t('Create an account')}
          </Link>
        </p>
      </div>
    </main>
  );
}
