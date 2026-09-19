'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useVenueSearch } from '@zal/api-client';
import { VenueType, type VenueSearchQuery, type VenueSort } from '@zal/contracts';
import { BottomNav } from '@/components/bottom-nav';
import { VenueCard, VenueCardSkeleton } from '@/components/venue-card';
import { Button, EmptyState, ErrorNote } from '@/components/ui';
import { ChevronLeft, SearchIcon, SlidersIcon } from '@/components/icons';
import { useT } from '@/lib/i18n';

const TYPE_LABELS: Record<string, string> = {
  BANQUET_HALL: 'Banquet hall',
  RESTAURANT: 'Restaurant',
  GARDEN: 'Garden',
  ROOFTOP: 'Rooftop',
  CORPORATE: 'Corporate',
  OUTDOOR: 'Outdoor',
};

const SORTS: { value: VenueSort; label: string }[] = [
  { value: 'RECOMMENDED', label: 'Recommended' },
  { value: 'TOP_RATED', label: 'Top rated' },
  { value: 'PRICE_ASC', label: 'Price: low to high' },
  { value: 'CAPACITY_DESC', label: 'Largest first' },
];

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <SearchScreen />
    </Suspense>
  );
}

/**
 * Search state lives in the URL.
 *
 * That is what makes a filtered result set shareable, restorable with the back
 * button, and cacheable by React Query without inventing a second source of
 * truth for "what is currently filtered".
 */
function SearchScreen() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo<Partial<VenueSearchQuery>>(() => {
    const types = params.getAll('types');
    const amenities = params.getAll('amenities');

    return {
      ...(params.get('q') ? { q: params.get('q') as string } : {}),
      ...(types.length ? { types: types as VenueSearchQuery['types'] } : {}),
      ...(amenities.length ? { amenities: amenities as VenueSearchQuery['amenities'] } : {}),
      ...(params.get('minPriceAmd') ? { minPriceAmd: Number(params.get('minPriceAmd')) } : {}),
      ...(params.get('maxPriceAmd') ? { maxPriceAmd: Number(params.get('maxPriceAmd')) } : {}),
      ...(params.get('minCapacity') ? { minCapacity: Number(params.get('minCapacity')) } : {}),
      ...(params.get('maxCapacity') ? { maxCapacity: Number(params.get('maxCapacity')) } : {}),
      ...(params.get('date') ? { date: params.get('date') as string } : {}),
      sort: (params.get('sort') as VenueSort) ?? 'RECOMMENDED',
    };
  }, [params]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVenueSearch(query);

  const venues = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const activeFilterCount = countFilters(params);

  function update(next: Record<string, string | string[] | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      search.delete(key);
      if (value === null) continue;
      for (const entry of Array.isArray(value) ? value : [value]) search.append(key, entry);
    }
    router.replace(`/search?${search.toString()}`, { scroll: false });
  }

  return (
    <main className="page page--wide">
      <div className="row" style={{ gap: 12, padding: '20px 24px 0' }}>
        <Link href="/" className="icon-btn" aria-label={t('Back to home')}>
          <ChevronLeft size={18} />
        </Link>

        <form
          role="search"
          className="grow"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('q');
            update({ q: value ? String(value) : null });
          }}
        >
          <label className="sr-only" htmlFor="venue-search">
            {t('Search venues')}
          </label>
          <div
            className="row"
            style={{
              gap: 8,
              padding: '0 16px',
              borderRadius: 14,
              background: 'var(--zal-white)',
              border: '1.5px solid var(--zal-line)',
            }}
          >
            <SearchIcon size={16} style={{ color: 'var(--zal-ink-muted)' }} />
            <input
              id="venue-search"
              name="q"
              defaultValue={query.q ?? ''}
              placeholder={t('Banquet halls · Yerevan')}
              className="grow"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '14px 0',
                fontSize: 14,
                fontWeight: 600,
                minWidth: 0,
              }}
            />
          </div>
        </form>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className="icon-btn"
          aria-expanded={filtersOpen}
          aria-controls="filters"
          aria-label={
            activeFilterCount
              ? t('Filters, {count} active', { count: activeFilterCount })
              : t('Filters')
          }
          style={{
            background: 'var(--zal-pomegranate)',
            color: 'var(--zal-ivory)',
            position: 'relative',
          }}
        >
          <SlidersIcon size={17} />
          {activeFilterCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: 'var(--zal-apricot)',
                color: '#3A2408',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid var(--zal-ivory)',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <Filters
          id="filters"
          params={params}
          onChange={update}
          onClear={() => router.replace('/search', { scroll: false })}
          resultCount={total}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      <div className="scroller" style={{ gap: 10, paddingTop: 16, paddingBottom: 0 }}>
        {Object.values(VenueType).map((type) => {
          const active = (query.types ?? []).includes(type);
          return (
            <button
              key={type}
              type="button"
              className="chip"
              aria-pressed={active}
              onClick={() => {
                const current = params.getAll('types');
                const next = active
                  ? current.filter((entry) => entry !== type)
                  : [...current, type];
                update({ types: next.length ? next : null });
              }}
            >
              {TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      <div className="spread section" style={{ paddingTop: 18 }}>
        <span style={{ fontSize: 13.5, color: 'var(--zal-ink-soft)' }}>
          <strong style={{ color: 'var(--zal-ink)' }}>{total}</strong>{' '}
          {total === 1 ? 'venue' : 'venues'} available
        </span>

        <label className="row" style={{ gap: 6 }}>
          <span className="sr-only">{t('Sort results')}</span>
          <select
            value={query.sort}
            onChange={(event) => update({ sort: event.target.value })}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--zal-pomegranate)',
              fontWeight: 700,
              fontSize: 13,
              minHeight: 44,
            }}
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {t(sort.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="venue-grid">
        <ErrorNote error={error} />

        {isLoading
          ? [0, 1, 2].map((index) => <VenueCardSkeleton key={index} />)
          : venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)}
      </div>

      {!isLoading && venues.length === 0 && !error && (
        <EmptyState
          title={t('No halls match that yet')}
          body="Try widening the guest count or the price range — or clear the filters and start again."
          action={
            <Button variant="secondary" onClick={() => router.replace('/search')}>
              {t('Clear filters')}
            </Button>
          }
        />
      )}

      {hasNextPage && (
        <div style={{ padding: '0 24px 32px' }}>
          <Button
            variant="secondary"
            block
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t('Show more')}
          </Button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function countFilters(params: URLSearchParams): number {
  const keys = [
    'types',
    'amenities',
    'minPriceAmd',
    'maxPriceAmd',
    'minCapacity',
    'maxCapacity',
    'date',
  ];
  return keys.reduce((count, key) => count + (params.getAll(key).length > 0 ? 1 : 0), 0);
}

const CAPACITY_BANDS = [
  { label: '<100', min: 0, max: 100 },
  { label: '100–250', min: 100, max: 250 },
  { label: '250–500', min: 250, max: 500 },
  { label: '500+', min: 500, max: undefined },
];

const AMENITIES = [
  { code: 'PARKING', label: 'Parking on site' },
  { code: 'CATERING', label: 'Catering included' },
  { code: 'SOUND_DJ', label: 'Sound & DJ booth' },
  { code: 'OUTDOOR_TERRACE', label: 'Outdoor terrace' },
  { code: 'AIR_CONDITIONING', label: 'Air conditioning' },
  { code: 'DANCE_FLOOR', label: 'Dance floor' },
];

function Filters({
  id,
  params,
  onChange,
  onClear,
  onClose,
  resultCount,
}: {
  id: string;
  params: URLSearchParams;
  onChange: (next: Record<string, string | string[] | null>) => void;
  onClear: () => void;
  onClose: () => void;
  resultCount: number;
}) {
  const t = useT();
  const selectedAmenities = params.getAll('amenities');

  return (
    <section id={id} className="card" style={{ margin: '16px 24px 0' }} aria-label={t('Filters')}>
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>
          {t('Guest capacity')}
        </legend>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {CAPACITY_BANDS.map((band) => {
            const active =
              params.get('minCapacity') === String(band.min) &&
              (band.max === undefined
                ? !params.get('maxCapacity')
                : params.get('maxCapacity') === String(band.max));

            return (
              <button
                key={band.label}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active
                      ? { minCapacity: null, maxCapacity: null }
                      : {
                          minCapacity: String(band.min),
                          maxCapacity: band.max === undefined ? null : String(band.max),
                        },
                  )
                }
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>
          {t('Price ceiling (AMD per event)')}
        </legend>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {[300_000, 450_000, 650_000, 1_000_000].map((ceiling) => {
            const active = params.get('maxPriceAmd') === String(ceiling);
            return (
              <button
                key={ceiling}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => onChange({ maxPriceAmd: active ? null : String(ceiling) })}
              >
                Under {(ceiling / 1000).toFixed(0)}k
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>
          {t('Amenities')}
        </legend>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {AMENITIES.map((amenity) => {
            const active = selectedAmenities.includes(amenity.code);
            return (
              <button
                key={amenity.code}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => {
                  const next = active
                    ? selectedAmenities.filter((code) => code !== amenity.code)
                    : [...selectedAmenities, amenity.code];
                  onChange({ amenities: next.length ? next : null });
                }}
              >
                {t(amenity.label)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="field" style={{ marginBottom: 20 }}>
        <span>{t('Available on')}</span>
        <input
          type="date"
          className="input"
          value={params.get('date') ?? ''}
          onChange={(event) => onChange({ date: event.target.value || null })}
        />
      </label>

      <div className="row" style={{ gap: 12 }}>
        <Button variant="secondary" onClick={onClear}>
          {t('Clear all')}
        </Button>
        <Button block onClick={onClose}>
          Show {resultCount} {resultCount === 1 ? 'hall' : 'halls'}
        </Button>
      </div>
    </section>
  );
}
