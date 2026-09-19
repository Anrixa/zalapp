'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ZalApiError, useRegister } from '@zal/api-client';
import { registerSchema } from '@zal/contracts';
import { Button, ErrorNote } from '@/components/ui';
import { ChevronLeft, GoogleMark } from '@/components/icons';
import { useLocale, useT } from '@/lib/i18n';

/**
 * Create an account.
 *
 * Validated client-side with the very schema the API validates against, so the
 * two cannot disagree about what a valid Armenian phone number looks like. The
 * phone is assembled from a fixed +374 prefix and the local part, because that
 * is how people say their number here and asking for E.164 gets it typed wrong.
 */
export default function SignUpPage() {
  const t = useT();
  const router = useRouter();
  const { locale } = useLocale();
  const register = useRegister();

  const [form, setForm] = useState({
    fullName: '',
    localPhone: '',
    email: '',
    password: '',
    acceptedTerms: false,
  });
  const [issues, setIssues] = useState<Record<string, string>>({});

  const serverError = register.error;
  const fieldError = (path: string) =>
    issues[path] ?? (serverError instanceof ZalApiError ? serverError.fieldError(path) : undefined);

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const phone = `+374${form.localPhone.replace(/\D/g, '')}`;
    const candidate = {
      fullName: form.fullName.trim(),
      phone,
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      password: form.password,
      locale,
      acceptedTerms: form.acceptedTerms,
    };

    const parsed = registerSchema.safeParse(candidate);
    if (!parsed.success) {
      setIssues(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }

    setIssues({});
    register.mutate(parsed.data, {
      onSuccess: (challenge) =>
        router.push(
          `/verify?verificationId=${challenge.verificationId}&hint=${encodeURIComponent(
            challenge.phoneHint,
          )}`,
        ),
    });
  }

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
      <div style={{ padding: '20px 24px 0' }}>
        <Link href="/login" className="icon-btn" aria-label="Back">
          <ChevronLeft size={18} />
        </Link>
      </div>

      <form className="grow section" style={{ paddingTop: 20 }} onSubmit={submit} noValidate>
        <h1 className="display" style={{ fontSize: 28, margin: 0 }}>
          {t('Create your account')}
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--zal-ink-soft)' }}>
          {t('It takes less than a minute.')}
        </p>

        <div style={{ marginTop: 26 }}>
          <ErrorNote error={serverError} />

          <label className="field">
            <span>{t('Full name')}</span>
            <input
              className="input"
              autoComplete="name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              aria-invalid={Boolean(fieldError('fullName'))}
              required
            />
            {fieldError('fullName') && (
              <span className="field-error">{fieldError('fullName')}</span>
            )}
          </label>

          <div className="field">
            <span>{t('Phone number')}</span>
            <div className="row" style={{ gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 74,
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  border: '1.5px solid var(--zal-line)',
                  background: 'var(--zal-white)',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                +374
              </span>
              <label className="grow">
                <span className="sr-only">{t('Phone number')}</span>
                <input
                  className="input"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="77 123 456"
                  value={form.localPhone}
                  onChange={(event) => setForm({ ...form, localPhone: event.target.value })}
                  aria-invalid={Boolean(fieldError('phone'))}
                  required
                />
              </label>
            </div>
            {fieldError('phone') && <span className="field-error">{fieldError('phone')}</span>}
          </div>

          <label className="field">
            <span>
              {t('Email')}{' '}
              <span style={{ color: 'var(--zal-ink-muted)', fontWeight: 500 }}>
                {t('(optional)')}
              </span>
            </span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              aria-invalid={Boolean(fieldError('email'))}
            />
            {fieldError('email') && <span className="field-error">{fieldError('email')}</span>}
          </label>

          <label className="field">
            <span>{t('Password')}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder={t('At least 8 characters')}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              aria-invalid={Boolean(fieldError('password'))}
              required
            />
            {fieldError('password') && (
              <span className="field-error">{fieldError('password')}</span>
            )}
          </label>

          <label className="row" style={{ gap: 10, alignItems: 'flex-start', marginTop: 18 }}>
            <input
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })}
              style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--zal-pomegranate)' }}
              aria-invalid={Boolean(fieldError('acceptedTerms'))}
            />
            <span style={{ fontSize: 12.5, color: 'var(--zal-ink-soft)', lineHeight: 1.5 }}>
              {t("I agree to Zal's")}{' '}
              <a href="#" style={{ color: 'var(--zal-pomegranate)', fontWeight: 600 }}>
                {t('Terms of Service')}
              </a>{' '}
              {t('and')}{' '}
              <a href="#" style={{ color: 'var(--zal-pomegranate)', fontWeight: 600 }}>
                {t('Privacy Policy')}
              </a>
              .
            </span>
          </label>
          {fieldError('acceptedTerms') && (
            <span className="field-error">{fieldError('acceptedTerms')}</span>
          )}
        </div>

        <Button type="submit" block style={{ marginTop: 22 }} loading={register.isPending}>
          {t('Create account')}
        </Button>
      </form>

      <div className="stack" style={{ gap: 14, padding: '16px 24px 32px' }}>
        <div
          className="row"
          style={{ gap: 10, color: 'var(--zal-ink-muted)', fontSize: 12, fontWeight: 600 }}
        >
          <span className="grow" style={{ height: 1, background: 'var(--zal-line)' }} />
          OR
          <span className="grow" style={{ height: 1, background: 'var(--zal-line)' }} />
        </div>

        <Button variant="secondary" block disabled title="Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID">
          <GoogleMark />
          {t('Continue with Google')}
        </Button>

        <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--zal-ink-soft)' }}>
          {t('Already have an account?')}{' '}
          <Link href="/login" style={{ color: 'var(--zal-pomegranate)', fontWeight: 700 }}>
            {t('Log in')}
          </Link>
        </p>
      </div>
    </main>
  );
}
