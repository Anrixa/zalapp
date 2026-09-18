import type {
  AddOn as AddOnRow,
  HostProfile,
  User,
  Venue,
  VenueAmenity,
  VenueImage,
  VenuePrice,
} from '@prisma/client';
import type { AddOn, VenueDetail, VenueSummary } from '@zal/contracts';
import { toHostDto } from '../users/user.mapper';
import { amenityLabel } from '../config/app-config.controller';

export type VenueWithRelations = Venue & {
  images: VenueImage[];
  amenities: VenueAmenity[];
  prices: VenuePrice[];
  addOns: AddOnRow[];
  host: HostProfile & { user?: Pick<User, 'avatarUrl'> | null };
};

export function toImageDto(image: VenueImage) {
  return {
    id: image.id,
    url: image.url,
    blurhash: image.blurhash,
    width: image.width,
    height: image.height,
    position: image.position,
  };
}

export function toAddOnDto(addOn: AddOnRow): AddOn {
  return {
    id: addOn.id,
    code: addOn.code,
    name: addOn.name,
    description: addOn.description,
    priceAmd: addOn.priceAmd,
    mandatory: addOn.mandatory,
  };
}

/**
 * The "from" price on a card is the cheapest slot, not the average and not the
 * evening rate — a card that quotes more than the guest can actually pay for
 * the hall is the kind of small dishonesty that costs trust at checkout.
 */
export function fromPrice(prices: VenuePrice[]): number {
  if (prices.length === 0) return 0;
  return Math.min(...prices.map((price) => price.priceAmd));
}

export function toVenueSummary(
  venue: Venue & { images?: VenueImage[]; prices?: VenuePrice[] },
  options: { isSaved?: boolean } = {},
): VenueSummary {
  const cover = [...(venue.images ?? [])].sort((a, b) => a.position - b.position)[0];

  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    district: venue.district,
    city: venue.city,
    capacityMax: venue.capacityMax,
    fromPriceAmd: fromPrice(venue.prices ?? []),
    ratingAvg: venue.ratingAvg,
    reviewCount: venue.reviewCount,
    coverImage: cover ? toImageDto(cover) : null,
    isSaved: options.isSaved ?? false,
  };
}

export function toVenueDetail(
  venue: VenueWithRelations,
  extras: {
    isSaved: boolean;
    ratingBreakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
    hostVenueCount: number;
    hostRatingAvg: number | null;
    locale?: 'en' | 'hy' | 'ru';
  },
): VenueDetail {
  const locale = extras.locale ?? 'en';

  return {
    ...toVenueSummary(venue, { isSaved: extras.isSaved }),
    description: venue.description,
    address: {
      line1: venue.addressLine,
      district: venue.district,
      city: venue.city,
      country: venue.country,
      point: venue.lat !== null && venue.lng !== null ? { lat: venue.lat, lng: venue.lng } : null,
    },
    areaSqm: venue.areaSqm,
    parkingSpots: venue.parkingSpots,
    capacityMin: venue.capacityMin,
    depositRate: venue.depositRate,
    images: [...venue.images].sort((a, b) => a.position - b.position).map(toImageDto),
    amenities: venue.amenities.map((amenity) => ({
      code: amenity.code,
      label: amenityLabel(amenity.code, locale),
    })),
    addOns: venue.addOns
      .filter((addOn) => addOn.deletedAt === null)
      .sort((a, b) => a.position - b.position)
      .map(toAddOnDto),
    prices: venue.prices.map((price) => ({
      slot: price.slot,
      priceAmd: price.priceAmd,
      weekendPriceAmd: price.weekendPriceAmd,
    })),
    host: toHostDto(venue.host, {
      venueCount: extras.hostVenueCount,
      ratingAvg: extras.hostRatingAvg,
    }),
    ratingBreakdown: extras.ratingBreakdown,
    cancellationPolicy: {
      freeUntilDaysBefore: 14,
      note: 'Free cancellation up to 14 days before your event. After that, the deposit is non-refundable.',
    },
  };
}
