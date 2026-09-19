'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ZalApiError } from '@zal/api-client';
import { bookingStatusTone } from '@zal/tokens';
import type { BookingStatus } from '@zal/contracts';
import { ChevronLeft } from './icons';

export function Button({
  variant = 'primary',
  block,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn--${variant}${block ? ' btn--block' : ''} ${props.className ?? ''}`}
    >
      {loading ? 'Working…' : children}
    </button>
  );
}

/** A header with a back arrow and an optional step label, as the flows use. */
export function ScreenHeader({
  title,
  step,
  backHref,
  action,
}: {
  title: string;
  step?: string;
  backHref?: string;
  action?: ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="row" style={{ gap: 14, padding: '20px 24px 0', alignItems: 'flex-start' }}>
      {backHref ? (
        <Link href={backHref} className="icon-btn" aria-label="Go back">
          <ChevronLeft size={18} />
        </Link>
      ) : (
        <button
          type="button"
          className="icon-btn"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div className="grow">
        {step && <div className="eyebrow">{step}</div>}
        <h1 className="display" style={{ fontSize: 20, margin: step ? '2px 0 0' : 0 }}>
          {title}
        </h1>
      </div>

      {action}
    </header>
  );
}

/**
 * One place that turns a thrown error into a sentence.
 *
 * Screens pass whatever the mutation rejected with; this decides what to say.
 * A network fault and a 500 read differently to a guest, and neither should
 * surface as a stack trace or "[object Object]".
 */
export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;

  let message = 'Something went wrong. Please try again.';
  if (error instanceof ZalApiError) {
    message = error.isNetwork ? 'No connection. Check your network and try again.' : error.message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

/** Inline field error, wired to `aria-describedby` by the caller. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="field-error" id={id}>
      {message}
    </span>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const tone = bookingStatusTone[status];
  return (
    <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
      {tone.label}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ padding: '56px 32px', textAlign: 'center' }}>
      <h2 className="display" style={{ fontSize: 20, margin: 0 }}>
        {title}
      </h2>
      <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 8 }}>
        {body}
      </p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }} role="status">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          margin: '0 auto',
          borderRadius: 999,
          border: '3px solid var(--zal-line)',
          borderTopColor: 'var(--zal-pomegranate)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const letters =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => [...part][0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: 'var(--zal-pomegranate)',
        color: 'var(--zal-ivory)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--zal-font-display)',
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {letters}
    </div>
  );
}
