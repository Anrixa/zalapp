'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLogout, useMe } from '@zal/api-client';
import { BottomNav } from '@/components/bottom-nav';
import { Avatar, Button, EmptyState, Spinner } from '@/components/ui';
import {
  BellIcon,
  CalendarIcon,
  CardIcon,
  ChevronRight,
  HeartIcon,
  SettingsIcon,
} from '@/components/icons';
import { LOCALE_NAMES } from '@zal/i18n';
import { useLocale, useT } from '@/lib/i18n';

export default function ProfilePage() {
  const t = useT();
  const router = useRouter();
  const { locale } = useLocale();
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  if (isLoading) return <Spinner />;

  if (!me) {
    return (
      <main className="page">
        <EmptyState
          title="Sign in to see your profile"
          body="Your bookings, saved halls and payment methods live behind your account."
          action={
            <Link href="/login" className="btn btn--primary">
              {t('Log in')}
            </Link>
          }
        />
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="spread section" style={{ paddingTop: 22 }}>
        <h1 className="display" style={{ fontSize: 24, margin: 0 }}>
          {t('Profile')}
        </h1>
        <Link href="/settings" className="icon-btn" aria-label={t('Settings')}>
          <SettingsIcon size={18} />
        </Link>
      </header>

      <section className="row section" style={{ paddingTop: 24, gap: 16 }}>
        <Avatar name={me.fullName} size={72} />
        <div className="grow">
          <div className="display" style={{ fontSize: 19 }}>
            {me.fullName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--zal-ink-soft)', marginTop: 2 }}>{me.phone}</div>
        </div>
      </section>

      <div className="row section" style={{ gap: 12, paddingTop: 22 }}>
        <Stat value={me.stats.bookings} label={t('Bookings')} />
        <Stat value={me.stats.saved} label={t('Saved')} />
        <Stat value={me.stats.reviews} label={t('Reviews')} />
      </div>

      <nav style={{ marginTop: 16 }} aria-label={t('Account')}>
        <Item href="/bookings" Icon={CalendarIcon} label={t('My bookings')} />
        <Item href="/saved" Icon={HeartIcon} label={t('Saved venues')} />
        <Item href="/settings#payment" Icon={CardIcon} label={t('Payment methods')} />
        <Item
          href="/settings#notifications"
          Icon={BellIcon}
          label={t('Notification preferences')}
        />
        <Item
          href="/settings#language"
          Icon={SettingsIcon}
          label={t('Language')}
          trailing={LOCALE_NAMES[locale]}
        />
      </nav>

      <div className="section" style={{ paddingTop: 22, paddingBottom: 32 }}>
        <Button
          variant="danger"
          block
          loading={logout.isPending}
          onClick={() => logout.mutate(false, { onSuccess: () => router.replace('/login') })}
        >
          {t('Log out')}
        </Button>
      </div>

      <BottomNav />
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card grow" style={{ padding: 16, textAlign: 'center' }}>
      <div className="display" style={{ fontSize: 20 }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--zal-ink-soft)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Item({
  href,
  Icon,
  label,
  trailing,
}: {
  href: string;
  Icon: typeof BellIcon;
  label: string;
  trailing?: string;
}) {
  return (
    <Link href={href} className="row" style={{ gap: 14, padding: '15px 24px', minHeight: 56 }}>
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: 'var(--zal-ivory-2)',
          color: 'var(--zal-pomegranate)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={19} />
      </span>
      <span className="grow" style={{ fontWeight: 700, fontSize: 14.5 }}>
        {label}
      </span>
      {trailing ? (
        <span style={{ fontSize: 13, color: 'var(--zal-ink-muted)', fontWeight: 600 }}>
          {trailing}
        </span>
      ) : (
        <ChevronRight size={16} style={{ color: 'var(--zal-ink-muted)' }} />
      )}
    </Link>
  );
}
