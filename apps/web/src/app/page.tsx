'use client';

import Link from 'next/link';
import { useDiscover, useMe } from '@zal/api-client';
import type { VenueSummary } from '@zal/contracts';
import { BottomNav } from '@/components/bottom-nav';
import { VenueCard, VenueCardSkeleton } from '@/components/venue-card';
import { BellIcon, HallIcon, SearchIcon } from '@/components/icons';

const CATEGORIES = [
  {
    type: 'BANQUET_HALL',
    label: 'Banquet',
    bg: 'var(--zal-pomegranate-tint)',
    fg: 'var(--zal-pomegranate)',
  },
  {
    type: 'RESTAURANT',
    label: 'Restaurant',
    bg: 'var(--zal-apricot-tint)',
    fg: 'var(--zal-apricot-dark)',
  },
  { type: 'GARDEN', label: 'Garden', bg: 'var(--zal-sage-tint)', fg: 'var(--zal-sage)' },
  { type: 'ROOFTOP', label: 'Rooftop', bg: 'var(--zal-ivory-2)', fg: 'var(--zal-ink-soft)' },
  {
    type: 'CORPORATE',
    label: 'Corporate',
    bg: 'var(--zal-pomegranate-tint)',
    fg: 'var(--zal-pomegranate)',
  },
] as const;

export default function HomePage() {
  const { data: me } = useMe();
  const { data, isLoading } = useDiscover();

  return (
    <main className="page">
      <header className="spread" style={{ padding: '22px 24px 0' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--zal-ink-soft)', fontWeight: 600 }}>Barev,</div>
          <div className="display" style={{ fontSize: 22 }}>
            {me?.fullName ?? 'welcome to Zal'}
          </div>
        </div>
        <Link
          href="/notifications"
          className="icon-btn"
          style={{ background: 'var(--zal-white)', border: '1px solid var(--zal-card-line)' }}
          aria-label={
            me?.unreadNotifications
              ? `Notifications, ${me.unreadNotifications} unread`
              : 'Notifications'
          }
        >
          <BellIcon size={20} />
          {Boolean(me?.unreadNotifications) && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                marginLeft: 18,
                marginTop: -16,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: 'var(--zal-pomegranate)',
                border: '1.5px solid var(--zal-white)',
              }}
            />
          )}
        </Link>
      </header>

      <div className="section" style={{ marginTop: 20 }}>
        <Link
          href="/search"
          className="row"
          style={{
            gap: 10,
            padding: '15px 18px',
            borderRadius: 16,
            background: 'var(--zal-white)',
            border: '1.5px solid var(--zal-line)',
            color: 'var(--zal-ink-muted)',
            minHeight: 48,
          }}
        >
          <SearchIcon size={18} />
          <span style={{ fontSize: 14.5 }}>Search halls, restaurants, cities…</span>
        </Link>
      </div>

      <div className="scroller" style={{ gap: 18, paddingTop: 22 }}>
        {CATEGORIES.map((category) => (
          <Link
            key={category.type}
            href={`/search?types=${category.type}`}
            className="stack"
            style={{ alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: category.bg,
                color: category.fg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HallIcon size={24} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--zal-ink-soft)' }}>
              {category.label}
            </span>
          </Link>
        ))}
      </div>

      {data?.promo && (
        <Link
          href={data.promo.href ?? '/search'}
          className="row"
          style={{
            margin: '28px 24px 0',
            padding: 20,
            borderRadius: 20,
            background: 'linear-gradient(120deg, #241A18, #3B2A26)',
            gap: 14,
          }}
        >
          <div className="grow">
            <div
              style={{
                color: 'var(--zal-apricot)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              {data.promo.eyebrow}
            </div>
            <div
              className="display"
              style={{ color: 'var(--zal-ivory)', fontSize: 18, marginTop: 6, lineHeight: 1.25 }}
            >
              {data.promo.title}
            </div>
          </div>
          <HallIcon size={40} style={{ color: 'var(--zal-apricot)' }} />
        </Link>
      )}

      <Shelf title="Featured this week" venues={data?.featured} loading={isLoading} />
      <Shelf title="Open this weekend" venues={data?.openThisWeekend} loading={isLoading} />
      <Shelf title="New on Zal" venues={data?.nearby} loading={isLoading} />

      <BottomNav />
    </main>
  );
}

function Shelf({
  title,
  venues,
  loading,
}: {
  title: string;
  venues: VenueSummary[] | undefined;
  loading: boolean;
}) {
  // An empty shelf is hidden rather than shown as a blank strip: a heading with
  // nothing under it reads like a bug.
  if (!loading && (!venues || venues.length === 0)) return null;

  return (
    <section style={{ marginTop: 30 }}>
      <div className="spread section" style={{ alignItems: 'baseline' }}>
        <h2 className="section-title">{title}</h2>
        <Link href="/search" className="btn btn--ghost" style={{ fontSize: 13 }}>
          See all
        </Link>
      </div>

      <div className="scroller">
        {loading
          ? [0, 1].map((index) => <VenueCardSkeleton key={index} width={320} />)
          : venues?.map((venue) => <VenueCard key={venue.id} venue={venue} width={320} />)}
      </div>
    </section>
  );
}
