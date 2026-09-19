'use client';

import Link from 'next/link';
import { useToggleFavorite } from '@zal/api-client';
import { formatAmdPlain, type VenueSummary } from '@zal/contracts';
import { venueTypeTone } from '@zal/tokens';
import { HeartIcon, PinIcon, StarIcon, UsersIcon } from './icons';
import { placeholderGradient } from '@/lib/format';

const TYPE_LABEL: Record<VenueSummary['type'], string> = {
  BANQUET_HALL: 'Banquet hall',
  RESTAURANT: 'Restaurant',
  GARDEN: 'Garden',
  ROOFTOP: 'Rooftop',
  CORPORATE: 'Corporate',
  OUTDOOR: 'Outdoor',
};

/**
 * The venue card, shared by Home, Search and Saved.
 *
 * The heart is a real `<button>` inside the card rather than an overlay on the
 * link, so keyboard users reach it and screen readers announce it — and its
 * click is stopped from bubbling, because tapping "save" should never navigate.
 */
export function VenueCard({ venue, width }: { venue: VenueSummary; width?: number }) {
  const toggleFavorite = useToggleFavorite();
  const tone = venueTypeTone[venue.type];

  return (
    <article
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        width: width ? `${width}px` : '100%',
        position: 'relative',
      }}
    >
      <Link href={`/venues/${venue.slug}`} aria-label={`${venue.name}, ${venue.district}`}>
        <div
          style={{
            height: 168,
            background: venue.coverImage
              ? `url(${venue.coverImage.url}) center/cover`
              : placeholderGradient(venue.id),
          }}
        />
      </Link>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavorite.mutate(venue.id);
        }}
        disabled={toggleFavorite.isPending}
        aria-pressed={venue.isSaved}
        aria-label={venue.isSaved ? `Remove ${venue.name} from saved` : `Save ${venue.name}`}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: 'rgba(36,26,24,0.4)',
          backdropFilter: 'blur(6px)',
          color: venue.isSaved ? 'var(--zal-apricot)' : 'var(--zal-ivory)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HeartIcon size={18} filled={venue.isSaved} />
      </button>

      <Link href={`/venues/${venue.slug}`} tabIndex={-1} aria-hidden="true">
        <div style={{ padding: 16 }}>
          <div className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
            <div className="badge" style={{ background: tone.bg, color: tone.fg }}>
              {TYPE_LABEL[venue.type]}
            </div>
            {venue.ratingAvg !== null && (
              <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                <StarIcon size={15} style={{ color: 'var(--zal-apricot)' }} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{venue.ratingAvg.toFixed(1)}</span>
              </div>
            )}
          </div>

          <h3 className="display" style={{ fontSize: 18, margin: '10px 0 0' }}>
            {venue.name}
          </h3>

          <div
            className="row"
            style={{ gap: 6, marginTop: 6, color: 'var(--zal-ink-soft)', fontSize: 13 }}
          >
            <PinIcon size={14} />
            <span>{venue.district}</span>
            <span aria-hidden="true">·</span>
            <UsersIcon size={14} />
            <span>up to {venue.capacityMax} guests</span>
          </div>

          <div style={{ marginTop: 12, fontWeight: 800, fontSize: 15 }}>
            {formatAmdPlain(venue.fromPriceAmd)}
            <span style={{ fontWeight: 500, color: 'var(--zal-ink-soft)', fontSize: 13 }}>
              {' '}
              / event
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function VenueCardSkeleton({ width }: { width?: number }) {
  return (
    <div
      className="skeleton"
      style={{ height: 300, width: width ? `${width}px` : '100%' }}
      aria-hidden="true"
    />
  );
}
