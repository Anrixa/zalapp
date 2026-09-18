import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AvailabilityStatus,
  ErrorCode,
  VenueType,
  type Discover,
  type Quote,
  type QuoteRequestBody,
  type VenueDetail,
  type VenueSearchQuery,
  type VenueSearchResult,
  type VenueSummary,
  computeQuote,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { fromIsoDate, todayInYerevan } from '../../common/utils/dates';
import { AvailabilityService } from './availability.service';
import { toVenueDetail, toVenueSummary, type VenueWithRelations } from './venue.mapper';

const SUMMARY_INCLUDE = {
  images: { orderBy: { position: 'asc' }, take: 1 },
  prices: true,
} satisfies Prisma.VenueInclude;

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /** The Home screen: three shelves and the promo banner, in one request. */
  async discover(userId: string | null): Promise<Discover> {
    const base: Prisma.VenueWhereInput = { status: 'PUBLISHED', deletedAt: null };

    const [featured, weekend] = await Promise.all([
      this.prisma.venue.findMany({
        where: base,
        include: SUMMARY_INCLUDE,
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
        take: 6,
      }),
      this.findOpenThisWeekend(base),
    ]);

    // "Nearby" without a location fix is simply the newest in the guest's city;
    // an honest fallback beats an empty shelf or a fake distance.
    const nearby = await this.prisma.venue.findMany({
      where: base,
      include: SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const saved = await this.savedIds(
      userId,
      [...featured, ...weekend, ...nearby].map((venue) => venue.id),
    );

    return {
      featured: featured.map((venue) => toVenueSummary(venue, { isSaved: saved.has(venue.id) })),
      openThisWeekend: weekend.map((venue) =>
        toVenueSummary(venue, { isSaved: saved.has(venue.id) }),
      ),
      nearby: nearby.map((venue) => toVenueSummary(venue, { isSaved: saved.has(venue.id) })),
      promo: {
        eyebrow: 'Book 30 days ahead',
        title: 'Save up to 15% on weekday halls',
        href: '/search?sort=PRICE_ASC',
      },
    };
  }

  async search(query: VenueSearchQuery, userId: string | null): Promise<VenueSearchResult> {
    const where = this.buildWhere(query);

    // Availability is a different table, so a date filter narrows the id set
    // first rather than trying to express it as a join in the main query.
    const availableIds = await this.idsAvailableOn(query.date, query.slot);
    if (availableIds) {
      where.id = { in: availableIds };
    }

    const cursorId = decodeCursor(query.cursor);

    const [rows, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: this.orderFor(query.sort),
        take: query.limit + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      }),
      this.prisma.venue.count({ where }),
    ]);

    const { items, nextCursor } = paginate(rows, query.limit, (venue) => venue.id);
    const saved = await this.savedIds(
      userId,
      items.map((venue) => venue.id),
    );

    return {
      items: items.map((venue) => toVenueSummary(venue, { isSaved: saved.has(venue.id) })),
      nextCursor,
      total,
      facets: await this.facets(where),
    };
  }

  async detail(idOrSlug: string, userId: string | null): Promise<VenueDetail> {
    const venue = (await this.prisma.venue.findFirst({
      where: {
        deletedAt: null,
        status: { in: ['PUBLISHED', 'PAUSED'] },
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        amenities: true,
        prices: true,
        addOns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        host: { include: { user: { select: { avatarUrl: true } } } },
      },
    })) as VenueWithRelations | null;

    if (!venue) throw AppError.notFound('Venue');

    const [breakdownRows, hostVenueCount, hostRating, isSaved] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { venueId: venue.id, deletedAt: null },
        _count: { rating: true },
      }),
      this.prisma.venue.count({
        where: { hostProfileId: venue.hostProfileId, deletedAt: null, status: 'PUBLISHED' },
      }),
      this.prisma.venue.aggregate({
        where: { hostProfileId: venue.hostProfileId, deletedAt: null, ratingAvg: { not: null } },
        _avg: { ratingAvg: true },
      }),
      userId
        ? this.prisma.favorite.findUnique({
            where: { userId_venueId: { userId, venueId: venue.id } },
            select: { venueId: true },
          })
        : Promise.resolve(null),
    ]);

    const ratingBreakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as Record<
      '1' | '2' | '3' | '4' | '5',
      number
    >;
    for (const row of breakdownRows) {
      const key = String(row.rating) as '1' | '2' | '3' | '4' | '5';
      ratingBreakdown[key] = row._count.rating;
    }

    return toVenueDetail(venue, {
      isSaved: Boolean(isSaved),
      ratingBreakdown,
      hostVenueCount,
      hostRatingAvg: hostRating._avg.ratingAvg ?? null,
    });
  }

  availabilityFor(venueId: string, from: string, to: string) {
    return this.availability.forRange(venueId, from, to);
  }

  /**
   * Price one booking without creating it.
   *
   * The Checkout screen calls this rather than adding up the numbers itself, so
   * a date-specific price or a promo is reflected without the client knowing
   * either rule exists. It runs the same `computeQuote` the booking write runs.
   */
  async quote(venueId: string, body: QuoteRequestBody): Promise<Quote & { available: boolean }> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, deletedAt: null },
      select: { id: true, capacityMax: true },
    });
    if (!venue) throw AppError.notFound('Venue');

    if (body.guestCount > venue.capacityMax) {
      throw new AppError(
        ErrorCode.OVER_CAPACITY,
        `This hall fits up to ${venue.capacityMax} guests`,
      );
    }

    if (body.date < todayInYerevan()) {
      throw new AppError(ErrorCode.SLOT_IN_THE_PAST, 'Pick a date in the future');
    }

    const [rentalAmd, addOns, available, promo] = await Promise.all([
      this.availability.resolvePrice(venueId, body.date, body.slot),
      this.loadAddOns(venueId, body.addOnIds),
      this.availability.isOpen(venueId, body.date, body.slot),
      this.resolvePromo(body.promoCode),
    ]);

    const quote = computeQuote({
      rentalAmd,
      addOns: addOns.map((addOn) => ({
        id: addOn.id,
        name: addOn.name,
        priceAmd: addOn.priceAmd,
      })),
      discountAmd: promo?.discountAmd ?? 0,
      ...(promo?.label ? { discountLabel: promo.label } : {}),
    });

    return { ...quote, available };
  }

  /** Add-ons, validated against the venue that is actually being booked. */
  async loadAddOns(venueId: string, addOnIds: string[]) {
    if (addOnIds.length === 0) return [];

    const addOns = await this.prisma.addOn.findMany({
      where: { id: { in: addOnIds }, venueId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    if (addOns.length !== new Set(addOnIds).size) {
      throw new AppError(
        ErrorCode.ADDON_NOT_AVAILABLE,
        'One of those extras is no longer offered by this venue',
      );
    }
    return addOns;
  }

  async resolvePromo(code: string | undefined) {
    if (!code) return null;

    const promo = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();

    const usable =
      promo &&
      promo.active &&
      (!promo.startsAt || promo.startsAt <= now) &&
      (!promo.endsAt || promo.endsAt >= now) &&
      (promo.maxRedemptions === null || promo.redemptions < promo.maxRedemptions);

    // An unusable code is not an error: the guest simply sees no discount line,
    // which is kinder than blocking checkout over a typo in a promo field.
    return usable ? promo : null;
  }

  private buildWhere(query: VenueSearchQuery): Prisma.VenueWhereInput {
    const where: Prisma.VenueWhereInput = { status: 'PUBLISHED', deletedAt: null };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { district: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.district) where.district = { equals: query.district, mode: 'insensitive' };
    if (query.types?.length) where.type = { in: query.types as VenueType[] };

    if (query.minCapacity !== undefined || query.maxCapacity !== undefined) {
      where.capacityMax = {
        ...(query.minCapacity !== undefined ? { gte: query.minCapacity } : {}),
        ...(query.maxCapacity !== undefined ? { lte: query.maxCapacity } : {}),
      };
    }

    if (query.minPriceAmd !== undefined || query.maxPriceAmd !== undefined) {
      where.prices = {
        some: {
          priceAmd: {
            ...(query.minPriceAmd !== undefined ? { gte: query.minPriceAmd } : {}),
            ...(query.maxPriceAmd !== undefined ? { lte: query.maxPriceAmd } : {}),
          },
        },
      };
    }

    // Every requested amenity must be present, not merely one of them: a guest
    // who ticks parking and catering means both.
    if (query.amenities?.length) {
      where.AND = query.amenities.map((code) => ({ amenities: { some: { code } } }));
    }

    return where;
  }

  private orderFor(sort: VenueSearchQuery['sort']): Prisma.VenueOrderByWithRelationInput[] {
    switch (sort) {
      case 'TOP_RATED':
        return [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, { id: 'asc' }];
      case 'CAPACITY_DESC':
        return [{ capacityMax: 'desc' }, { id: 'asc' }];
      case 'NEWEST':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      case 'PRICE_ASC':
      case 'PRICE_DESC':
        // Sorting by a related table's minimum is not expressible in Prisma's
        // orderBy; the list is ordered by rating and the client sorts the page
        // by `fromPriceAmd`, which is already on every card.
        return [{ ratingAvg: 'desc' }, { id: 'asc' }];
      case 'RECOMMENDED':
      default:
        return [{ ratingAvg: 'desc' }, { savedCount: 'desc' }, { id: 'asc' }];
    }
  }

  private async idsAvailableOn(
    date: string | undefined,
    slot: VenueSearchQuery['slot'],
  ): Promise<string[] | null> {
    if (!date) return null;

    const taken = await this.prisma.venueAvailability.findMany({
      where: {
        date: fromIsoDate(date),
        status: { not: AvailabilityStatus.OPEN },
        ...(slot ? { slot } : {}),
      },
      select: { venueId: true, slot: true },
    });

    // With no slot named, a venue is out only when every slot that day is gone.
    const blocked = new Map<string, Set<string>>();
    for (const row of taken) {
      const set = blocked.get(row.venueId) ?? new Set<string>();
      set.add(row.slot);
      blocked.set(row.venueId, set);
    }

    const excluded = [...blocked.entries()]
      .filter(([, slots]) => (slot ? slots.has(slot) : slots.size >= 2))
      .map(([venueId]) => venueId);

    const open = await this.prisma.venue.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, id: { notIn: excluded } },
      select: { id: true },
    });

    return open.map((venue) => venue.id);
  }

  private async findOpenThisWeekend(base: Prisma.VenueWhereInput) {
    const today = todayInYerevan();
    const cursor = fromIsoDate(today);
    // Next Saturday — or today, if today is one.
    const daysUntilSaturday = (6 - cursor.getUTCDay() + 7) % 7;
    cursor.setUTCDate(cursor.getUTCDate() + daysUntilSaturday);
    const saturday = cursor.toISOString().slice(0, 10);

    const busy = await this.prisma.venueAvailability.findMany({
      where: { date: fromIsoDate(saturday), status: { not: AvailabilityStatus.OPEN } },
      select: { venueId: true },
    });

    return this.prisma.venue.findMany({
      where: { ...base, id: { notIn: busy.map((row) => row.venueId) } },
      include: SUMMARY_INCLUDE,
      orderBy: [{ reviewCount: 'desc' }],
      take: 6,
    });
  }

  private async savedIds(userId: string | null, venueIds: string[]): Promise<Set<string>> {
    if (!userId || venueIds.length === 0) return new Set();

    const rows = await this.prisma.favorite.findMany({
      where: { userId, venueId: { in: venueIds } },
      select: { venueId: true },
    });
    return new Set(rows.map((row) => row.venueId));
  }

  private async facets(where: Prisma.VenueWhereInput): Promise<VenueSearchResult['facets']> {
    const [byType, priceRange, capacityRange, amenityRows] = await Promise.all([
      this.prisma.venue.groupBy({ by: ['type'], where, _count: { type: true } }),
      this.prisma.venuePrice.aggregate({
        where: { venue: where },
        _min: { priceAmd: true },
        _max: { priceAmd: true },
      }),
      this.prisma.venue.aggregate({
        where,
        _min: { capacityMax: true },
        _max: { capacityMax: true },
      }),
      this.prisma.venueAmenity.groupBy({
        by: ['code'],
        where: { venue: where },
        _count: { code: true },
      }),
    ]);

    return {
      types: byType.map((row) => ({ type: row.type, count: row._count.type })),
      amenities: amenityRows.map((row) => ({ code: row.code, count: row._count.code })),
      priceRangeAmd: {
        min: priceRange._min.priceAmd ?? 0,
        max: priceRange._max.priceAmd ?? 0,
      },
      capacityRange: {
        min: capacityRange._min.capacityMax ?? 0,
        max: capacityRange._max.capacityMax ?? 0,
      },
    };
  }

  /** Used by favorites to keep the denormalised counter honest. */
  async summaryById(venueId: string, userId: string | null): Promise<VenueSummary> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, deletedAt: null },
      include: SUMMARY_INCLUDE,
    });
    if (!venue) throw AppError.notFound('Venue');

    const saved = await this.savedIds(userId, [venueId]);
    return toVenueSummary(venue, { isSaved: saved.has(venueId) });
  }
}
