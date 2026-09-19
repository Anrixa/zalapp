'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ZalApiError, useVerifyOtp, useZalApi } from '@zal/api-client';
import { Button, ErrorNote } from '@/components/ui';
import { ChevronLeft } from '@/components/icons';
import { useT } from '@/lib/i18n';

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <VerifyScreen />
    </Suspense>
  );
}

/**
 * The six-digit code screen.
 *
 * One input per digit, as the design draws it, but with the behaviour people
 * expect from their bank app: typing advances, backspace on an empty box steps
 * back, and pasting a whole code from the SMS fills every box at once. The
 * inputs are `inputMode="numeric"` and `autoComplete="one-time-code"` so iOS
 * offers the code straight from the notification.
 */
function VerifyScreen() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const api = useZalApi();

  const verificationId = search.get('verificationId') ?? '';
  const hint = search.get('hint') ?? '';
  const next = search.get('next') ?? '/';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(45);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const verify = useVerifyOtp();
  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Submit as soon as the sixth digit lands — nobody wants to press a button
  // after typing a code they just read off a notification.
  useEffect(() => {
    if (code.length === 6 && !verify.isPending) {
      verify.mutate({ verificationId, code }, { onSuccess: () => router.replace(next) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, '');

    if (clean.length > 1) {
      // A paste: spread it across the boxes from here on.
      const next = [...digits];
      for (let offset = 0; offset < clean.length && index + offset < 6; offset += 1) {
        next[index + offset] = clean[offset]!;
      }
      setDigits(next);
      inputs.current[Math.min(5, index + clean.length)]?.focus();
      return;
    }

    const updated = [...digits];
    updated[index] = clean;
    setDigits(updated);
    if (clean) inputs.current[index + 1]?.focus();
  }

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
      <div style={{ padding: '20px 24px 0' }}>
        <Link href="/signup" className="icon-btn" aria-label="Back">
          <ChevronLeft size={18} />
        </Link>
      </div>

      <div className="grow section" style={{ paddingTop: 28 }}>
        <h1 className="display" style={{ fontSize: 27, margin: 0 }}>
          {t('Enter the code')}
        </h1>
        <p style={{ marginTop: 8, fontSize: 14.5, color: 'var(--zal-ink-soft)', lineHeight: 1.5 }}>
          {t('We sent a 6-digit code by SMS to')}{' '}
          <strong style={{ color: 'var(--zal-ink)' }}>{hint}</strong>.
        </p>

        <ErrorNote error={verify.error} />

        <div className="row" style={{ gap: 10, marginTop: 24 }}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && !digits[index]) {
                  inputs.current[index - 1]?.focus();
                }
              }}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={6}
              aria-label={`Digit ${index + 1} of 6`}
              style={{
                width: 46,
                height: 56,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 700,
                fontFamily: 'var(--zal-font-display)',
                borderRadius: 14,
                border: `1.5px solid ${digit ? 'var(--zal-pomegranate)' : 'var(--zal-line)'}`,
                background: 'var(--zal-white)',
                color: 'var(--zal-ink)',
              }}
            />
          ))}
        </div>

        <div style={{ marginTop: 22, fontSize: 13.5, color: 'var(--zal-ink-soft)' }}>
          {t("Didn't get it?")}{' '}
          {cooldown > 0 ? (
            <span style={{ fontWeight: 700 }}>
              {t('Resend in')} 0:{String(cooldown).padStart(2, '0')}
            </span>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                void api.auth.resendOtp(verificationId).then(() => setCooldown(45));
              }}
            >
              {t('Resend')}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 24px 36px' }}>
        <Button
          block
          loading={verify.isPending}
          disabled={code.length !== 6}
          onClick={() =>
            verify.mutate({ verificationId, code }, { onSuccess: () => router.replace(next) })
          }
        >
          {t('Verify & continue')}
        </Button>

        {verify.error instanceof ZalApiError && verify.error.code === 'OTP_EXPIRED' && (
          <p className="field-error" style={{ textAlign: 'center', marginTop: 10 }}>
            {verify.error.message}
          </p>
        )}
      </div>
    </main>
  );
}
