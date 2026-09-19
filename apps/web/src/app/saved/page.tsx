'use client';

import Link from 'next/link';
import { useFavorites } from '@zal/api-client';
import { BottomNav } from '@/components/bottom-nav';
import { VenueCard, VenueCardSkeleton } from '@/components/venue-card';
import { Button, EmptyState, ErrorNote } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function SavedPage() {
  const t = useT();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useFavorites();

  const favorites = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="page page--wide">
      <header className="section" style={{ paddingTop: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--zal-ink-soft)', fontWeight: 600 }}>
          {favorites.length} {favorites.length === 1 ? t('hall saved') : t('halls saved')}
        </div>
        <h1 className="display" style={{ fontSize: 26, margin: '4px 0 0' }}>
          {t('Your shortlist')}
        </h1>
      </header>

      <div className="venue-grid" style={{ paddingTop: 20 }}>
        <ErrorNote error={error} />
        {isLoading
          ? [0, 1].map((index) => <VenueCardSkeleton key={index} />)
          : favorites.map((favorite) => (
              <VenueCard key={favorite.venue.id} venue={favorite.venue} />
            ))}
      </div>

      {!isLoading && favorites.length === 0 && !error && (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on a hall you like and it will wait for you here while you compare."
          action={
            <Link href="/search" className="btn btn--primary">
              {t('Search')}
            </Link>
          }
        />
      )}

      {hasNextPage && (
        <div className="section" style={{ paddingBottom: 24 }}>
          <Button
            variant="secondary"
            block
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t('See all')}
          </Button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
