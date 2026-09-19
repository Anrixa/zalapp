'use client';

import Link from 'next/link';
import { useToggleFavorite, useVenue, useVenueReviews } from '@zal/api-client';
import { formatAmdPlain } from '@zal/contracts';
import { venueTypeTone } from '@zal/tokens';
import { Avatar, EmptyState, Spinner } from '@/components/ui';
import {
  ChevronLeft,
  HeartIcon,
  MessageIcon,
  PinIcon,
  ShareIcon,
  StarIcon,
} from '@/components/icons';
import { placeholderGradient } from '@/lib/format';
import { useT } from '@/lib/i18n';

const TYPE_LABEL: Record<string, string> = {
  BANQUET_HALL: 'Banquet hall',
  RESTAURANT: 'Restaurant',
  GARDEN: 'Garden',
  ROOFTOP: 'Rooftop',
  CORPORATE: 'Corporate',
  OUTDOOR: 'Outdoor',
};

export default function VenueDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const t = useT();
  const { data: venue, isLoading, error } = useVenue(slug);
  const { data: reviewPages } = useVenueReviews(venue?.id, { limit: 3 });
  const toggleFavorite = useToggleFavorite();

  if (isLoading) return <Spinner label="Loading venue" />;

  if (error || !venue) {
    return (
      <main className="page">
        <EmptyState
          title="We could not find that venue"
          body="It may have been taken down. Try searching for something similar."
        />
      </main>
    );
  }

  const tone = venueTypeTone[venue.type];
  const reviews = reviewPages?.pages.flatMap((page) => page.items) ?? [];
  const eveningPrice =
    venue.prices.find((price) => price.slot === 'EVENING')?.priceAmd ?? venue.fromPriceAmd;

  return (
    <main className="page">
      {/* Hero */}
      <div
        style={{
          position: 'relative',
          height: 320,
          background: venue.images[0]
            ? `url(${venue.images[0].url}) center/cover`
            : placeholderGradient(venue.id),
        }}
      >
        <div className="spread" style={{ position: 'absolute', top: 20, left: 24, right: 24 }}>
          <Link href="/search" className="icon-btn" aria-label={t('Search')} style={scrimStyle}>
            <ChevronLeft size={18} />
          </Link>

          <div className="row" style={{ gap: 10 }}>
            <button
              type="button"
              className="icon-btn"
              style={scrimStyle}
              aria-label="Share this venue"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  void navigator.share({ title: venue.name, url: window.location.href });
                }
              }}
            >
              <ShareIcon size={17} />
            </button>

            <button
              type="button"
              className="icon-btn"
              style={{
                ...scrimStyle,
                color: venue.isSaved ? 'var(--zal-apricot)' : 'var(--zal-ivory)',
              }}
              aria-pressed={venue.isSaved}
              aria-label={venue.isSaved ? 'Remove from saved' : 'Save this venue'}
              onClick={() => toggleFavorite.mutate(venue.id)}
            >
              <HeartIcon size={17} filled={venue.isSaved} />
            </button>
          </div>
        </div>

        {venue.images.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              background: 'rgba(36,26,24,0.55)',
              color: 'var(--zal-ivory)',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 999,
            }}
          >
            1 / {venue.images.length} {t('photos')}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {venue.images.length > 1 && (
        <div className="row" style={{ gap: 8, padding: '14px 24px 0' }}>
          {venue.images.slice(1, 4).map((image) => (
            <div
              key={image.id}
              style={{
                flex: 1,
                height: 56,
                borderRadius: 12,
                background: `url(${image.url}) center/cover`,
              }}
            />
          ))}
          {venue.images.length > 4 && (
            <div
              style={{
                flex: 1,
                height: 56,
                borderRadius: 12,
                background: 'var(--zal-ivory-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--zal-ink-soft)',
              }}
            >
              +{venue.images.length - 4}
            </div>
          )}
        </div>
      )}

      <section className="section" style={{ marginTop: 22 }}>
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <span
              className="badge"
              style={{ background: tone.bg, color: tone.fg, textTransform: 'uppercase' }}
            >
              {t(TYPE_LABEL[venue.type] ?? venue.type)}
            </span>
            <h1 className="display" style={{ fontSize: 25, margin: '10px 0 0' }}>
              {venue.name}
            </h1>
          </div>

          {venue.ratingAvg !== null && (
            <div className="row" style={{ gap: 4, paddingTop: 4 }}>
              <StarIcon size={16} style={{ color: 'var(--zal-apricot)' }} />
              <span style={{ fontWeight: 800, fontSize: 15 }}>{venue.ratingAvg.toFixed(1)}</span>
            </div>
          )}
        </div>

        <div
          className="row"
          style={{ gap: 6, marginTop: 8, color: 'var(--zal-ink-soft)', fontSize: 14 }}
        >
          <PinIcon size={14} />
          <span>
            {venue.address.line1}, {venue.address.district}, {venue.address.city}
          </span>
        </div>

        <dl
          className="row"
          style={{
            gap: 20,
            marginTop: 18,
            padding: '16px 0',
            borderTop: '1px solid var(--zal-card-line)',
            borderBottom: '1px solid var(--zal-card-line)',
          }}
        >
          <Stat label={t('CAPACITY')} value={`${t('up to')} ${venue.capacityMax}`} />
          {venue.areaSqm !== null && <Stat label={t('SIZE')} value={`${venue.areaSqm} m²`} />}
          {venue.parkingSpots !== null && (
            <Stat label={t('PARKING')} value={`${venue.parkingSpots} ${t('spots')}`} />
          )}
        </dl>
      </section>

      {/* Host */}
      <section className="section row" style={{ marginTop: 24, gap: 12 }}>
        <Avatar name={venue.host.displayName} size={52} />
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>
            {t('Hosted by')} {venue.host.displayName}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--zal-ink-soft)' }}>
            {venue.host.respondsWithinMinutes ? `${t('Responds within an hour')} · ` : ''}
            {new Date().getFullYear() - venue.host.memberSince} {t('years on Zal')}
          </div>
        </div>
        <Link
          href={`/messages/new?venueId=${venue.id}`}
          className="icon-btn"
          aria-label={`Message ${venue.host.displayName}`}
        >
          <MessageIcon size={19} />
        </Link>
      </section>

      <section className="section" style={{ marginTop: 24 }}>
        <h2 className="section-title" style={{ fontSize: 18, marginBottom: 12 }}>
          {t('About this hall')}
        </h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--zal-ink-body)', margin: 0 }}>
          {venue.description}
        </p>
      </section>

      {venue.amenities.length > 0 && (
        <section className="section" style={{ marginTop: 24 }}>
          <h2 className="section-title" style={{ fontSize: 18, marginBottom: 12 }}>
            {t('Amenities')}
          </h2>
          <ul
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {venue.amenities.map((amenity) => (
              <li
                key={amenity.code}
                className="row"
                style={{
                  gap: 10,
                  padding: 12,
                  borderRadius: 14,
                  background: 'var(--zal-white)',
                  border: '1px solid var(--zal-card-line)',
                  fontSize: 13,
                }}
              >
                <StarIcon size={16} filled={false} style={{ color: 'var(--zal-pomegranate)' }} />
                <span>{t(amenity.label)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reviews */}
      <section className="section" style={{ marginTop: 24 }}>
        <div className="spread">
          <h2 className="section-title" style={{ fontSize: 18 }}>
            {t('Reviews')}
          </h2>
          {venue.reviewCount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--zal-pomegranate)' }}>
              {t('See all')} {venue.reviewCount}
            </span>
          )}
        </div>

        {venue.reviewCount === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>
            No reviews yet — this hall is waiting for its first celebration.
          </p>
        ) : (
          <>
            <div className="row" style={{ gap: 16, marginTop: 6 }}>
              <div className="display" style={{ fontSize: 40 }}>
                {venue.ratingAvg?.toFixed(1)}
              </div>
              <div className="grow">
                <div className="row" style={{ gap: 2, marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      size={14}
                      filled={star <= Math.round(venue.ratingAvg ?? 0)}
                      style={{ color: 'var(--zal-apricot)' }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--zal-ink-soft)' }}>
                  {venue.reviewCount} {t('reviews · from real bookings')}
                </div>
              </div>
            </div>

            {reviews.map((review) => (
              <article key={review.id} className="card" style={{ marginTop: 16, padding: 16 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar name={review.author.displayName} size={36} />
                  <div className="grow">
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                      {review.author.displayName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--zal-ink-muted)' }}>
                      {review.eventMonth}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{review.rating.toFixed(1)}</div>
                </div>
                {review.body && (
                  <p
                    style={{
                      fontSize: 13.5,
                      color: 'var(--zal-ink-body)',
                      marginTop: 10,
                      marginBottom: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {review.body}
                  </p>
                )}
              </article>
            ))}
          </>
        )}
      </section>

      {/* Sticky CTA */}
      <div className="sticky-bar" style={{ marginTop: 28 }}>
        <div>
          <div className="display" style={{ fontSize: 19 }}>
            {formatAmdPlain(eveningPrice)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--zal-ink-soft)' }}>
            {t('per event · deposit 20%')}
          </div>
        </div>
        <Link href={`/book/${venue.id}`} className="btn btn--primary grow">
          {t('Check availability')}
        </Link>
      </div>
    </main>
  );
}

const scrimStyle = {
  background: 'rgba(36,26,24,0.4)',
  backdropFilter: 'blur(6px)',
  color: 'var(--zal-ivory)',
} as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 11, color: 'var(--zal-ink-muted)', fontWeight: 700 }}>{label}</dt>
      <dd style={{ fontWeight: 800, fontSize: 15, margin: '3px 0 0' }}>{value}</dd>
    </div>
  );
}
