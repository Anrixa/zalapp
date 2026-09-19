import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, TimeSlot } from '@prisma/client';
import {
  AvailabilityStatus,
  BLOCKING_BOOKING_STATUSES,
  ErrorCode,
  VenueStatus,
  type AddVenuePhotoBody,
  type BlockDatesBody,
  type CreateVenueBody,
  type HostVenue,
  type HostVenueSummary,
  type ListHostVenuesQuery,
  type Page,
  type ReorderVenuePhotosBody,
  type SetVenueAddOnsBody,
  type SetVenuePricesBody,
  type SetVenueStatusBody,
  type UnblockDatesBody,
  type UpdateVenueBody,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { eachDate, fromIsoDate, todayInYerevan } from '../../common/utils/dates';
import { slugify } from '../../common/utils/text';
import { StorageService } from '../uploads/storage.service';
import { toVenueDetail, toVenueSummary, type VenueWithRelations } from './venue.mapper';
import { publishBlockers } from './publish-blockers';

const DETAIL_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  amenities: true,
  prices: true,
  addOns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
  host: { include: { user: { select: { avatarUrl: true } } } },
} satisfies Prisma.VenueInclude;

const ALL_SLOTS: TimeSlot[] = ['AFTERNOON', 'EVENING'];

/** How far ahead a single block/unblock call may reach. */
const MAX_BLOCK_DAYS = 400;

@Injectable()
export class HostVenuesService {
  private readonly logger = new Logger(HostVenuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /* ── Ownership ──────────────────────────────────────────────────────────
   * The HOST role says what kind of thing you may do; this says which rows you
   * may do it to. Both are required, and neither is sufficient — a host with a
   * valid token is still not allowed near another host's calendar.
   */

  private async ownedVenue(userId: string, venueId: string) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, deletedAt: null },
      include: { host: { select: { id: true, userId: true } } },
    });

    if (!venue) throw AppError.notFound('Venue');
    if (venue.host.userId !== userId) {
      // Deliberately the same error a stranger's venue id would produce, so
      // this endpoint cannot be used to discover which ids exist.
      throw AppError.notFound('Venue');
    }
    return venue;
  }

  /**
   * Find or create this user's host profile.
   *
   * Becoming a host is a side effect of listing a first venue rather than a
   * separate sign-up: the moment someone has a hall to offer, they are one.
   */
  private async ensureHostProfile(userId: string): Promise<string> {
    const existing = await this.prisma.hostProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, fullName: true, role: true },
    });
    if (!user) throw AppError.notFound('Account');

    const profile = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hostProfile.create({
        data: {
          userId,
          displayName: shortenName(user.fullName),
          memberSince: new Date().getUTCFullYear(),
        },
        select: { id: true },
      });

      // An admin stays an admin; a guest becomes a host.
      if (user.role === 'GUEST') {
        await tx.user.update({ where: { id: userId }, data: { role: 'HOST' } });
      }
      return created;
    });

    this.logger.log(`Created host profile for user ${userId}`);
    return profile.id;
  }

  /* ── Venues ─────────────────────────────────────────────────────────── */

  async create(userId: string, body: CreateVenueBody): Promise<HostVenue> {
    if (body.capacityMin !== null && body.capacityMin > body.capacityMax) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'The minimum capacity cannot be above the maximum',
        { fields: [{ path: 'capacityMin', message: 'Must be at or below the maximum' }] },
      );
    }

    const hostProfileId = await this.ensureHostProfile(userId);

    const venue = await this.prisma.venue.create({
      data: {
        hostProfileId,
        slug: await this.uniqueSlug(body.name),
        name: body.name,
        type: body.type,
        // A new venue is never live. The host publishes it once it has photos
        // and prices, which `publishBlockers` spells out.
        status: VenueStatus.DRAFT,
        description: body.description,
        addressLine: body.addressLine,
        district: body.district,
        city: body.city,
        lat: body.point?.lat ?? null,
        lng: body.point?.lng ?? null,
        capacityMin: body.capacityMin,
        capacityMax: body.capacityMax,
        areaSqm: body.areaSqm,
        parkingSpots: body.parkingSpots,
        amenities: { create: body.amenities.map((code) => ({ code })) },
      },
    });

    return this.detail(userId, venue.id);
  }

  async update(userId: string, venueId: string, body: UpdateVenueBody): Promise<HostVenue> {
    const venue = await this.ownedVenue(userId, venueId);

    const capacityMax = body.capacityMax ?? venue.capacityMax;
    const capacityMin = body.capacityMin === undefined ? venue.capacityMin : body.capacityMin;
    if (capacityMin !== null && capacityMin > capacityMax) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'The minimum capacity cannot be above the maximum',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.venue.update({
        where: { id: venueId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.addressLine !== undefined ? { addressLine: body.addressLine } : {}),
          ...(body.district !== undefined ? { district: body.district } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.point !== undefined
            ? { lat: body.point?.lat ?? null, lng: body.point?.lng ?? null }
            : {}),
          ...(body.capacityMin !== undefined ? { capacityMin: body.capacityMin } : {}),
          ...(body.capacityMax !== undefined ? { capacityMax: body.capacityMax } : {}),
          ...(body.areaSqm !== undefined ? { areaSqm: body.areaSqm } : {}),
          ...(body.parkingSpots !== undefined ? { parkingSpots: body.parkingSpots } : {}),
        },
      });

      if (body.amenities !== undefined) {
        // The slug is deliberately not regenerated from a renamed venue: links
        // already shared, and search results already indexed, should keep
        // working.
        await tx.venueAmenity.deleteMany({ where: { venueId } });
        await tx.venueAmenity.createMany({
          data: body.amenities.map((code) => ({ venueId, code })),
          skipDuplicates: true,
        });
      }
    });

    return this.detail(userId, venueId);
  }

  async list(userId: string, query: ListHostVenuesQuery): Promise<Page<HostVenueSummary>> {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return { items: [], nextCursor: null };

    const cursorId = decodeCursor(query.cursor);

    const rows = await this.prisma.venue.findMany({
      where: {
        hostProfileId: profile.id,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      include: { images: { orderBy: { position: 'asc' }, take: 1 }, prices: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (venue) => venue.id);
    const counts = await this.bookingCounts(items.map((venue) => venue.id));

    return {
      items: items.map((venue) => ({
        ...toVenueSummary(venue),
        status: venue.status,
        upcomingBookings: counts.get(venue.id)?.upcoming ?? 0,
        pendingBookings: counts.get(venue.id)?.pending ?? 0,
      })),
      nextCursor,
    };
  }

  async detail(userId: string, venueId: string): Promise<HostVenue> {
    await this.ownedVenue(userId, venueId);

    const venue = (await this.prisma.venue.findUniqueOrThrow({
      where: { id: venueId },
      include: DETAIL_INCLUDE,
    })) as VenueWithRelations & { status: VenueStatus };

    const counts = await this.bookingCounts([venueId]);

    return {
      ...toVenueDetail(venue, {
        isSaved: false,
        ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        hostVenueCount: 0,
        hostRatingAvg: venue.ratingAvg,
      }),
      status: venue.status,
      publishBlockers: publishBlockers(venue),
      upcomingBookings: counts.get(venueId)?.upcoming ?? 0,
    };
  }

  /**
   * Publish, pause or unpublish.
   *
   * Publishing is refused while anything in `publishBlockers` is outstanding —
   * a hall with no photos and no prices in search results is worse for the host
   * than not being listed at all.
   */
  async setStatus(userId: string, venueId: string, body: SetVenueStatusBody): Promise<HostVenue> {
    await this.ownedVenue(userId, venueId);

    if (body.status === VenueStatus.PUBLISHED) {
      const venue = (await this.prisma.venue.findUniqueOrThrow({
        where: { id: venueId },
        include: DETAIL_INCLUDE,
      })) as VenueWithRelations;

      const blockers = publishBlockers(venue);
      if (blockers.length > 0) {
        throw new AppError(
          ErrorCode.CONFLICT,
          `This venue is not ready to publish: ${blockers.join('; ')}`,
        );
      }
    }

    await this.prisma.venue.update({ where: { id: venueId }, data: { status: body.status } });
    return this.detail(userId, venueId);
  }

  /**
   * Archive a venue.
   *
   * Refused while anyone holds a date on it. A guest who paid a deposit has an
   * agreement, and a host should have to cancel those deliberately rather than
   * have them evaporate with the listing.
   */
  async archive(userId: string, venueId: string): Promise<{ ok: true }> {
    await this.ownedVenue(userId, venueId);

    const live = await this.prisma.booking.count({
      where: {
        venueId,
        status: { in: [...BLOCKING_BOOKING_STATUSES] },
        eventDate: { gte: fromIsoDate(todayInYerevan()) },
      },
    });

    if (live > 0) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `This venue still has ${live} upcoming booking${live === 1 ? '' : 's'}. Cancel or complete them first.`,
      );
    }

    await this.prisma.venue.update({
      where: { id: venueId },
      data: { status: VenueStatus.ARCHIVED, deletedAt: new Date() },
    });

    return { ok: true };
  }

  /* ── Prices and extras ──────────────────────────────────────────────── */

  async setPrices(userId: string, venueId: string, body: SetVenuePricesBody): Promise<HostVenue> {
    await this.ownedVenue(userId, venueId);

    await this.prisma.$transaction(
      body.prices.map((price) =>
        this.prisma.venuePrice.upsert({
          where: { venueId_slot: { venueId, slot: price.slot } },
          create: {
            venueId,
            slot: price.slot,
            priceAmd: price.priceAmd,
            weekendPriceAmd: price.weekendPriceAmd,
          },
          update: { priceAmd: price.priceAmd, weekendPriceAmd: price.weekendPriceAmd },
        }),
      ),
    );

    // Existing bookings keep the price they were quoted — the booking row
    // stores its own copy for exactly this reason.
    return this.detail(userId, venueId);
  }

  async setAddOns(userId: string, venueId: string, body: SetVenueAddOnsBody): Promise<HostVenue> {
    await this.ownedVenue(userId, venueId);

    const keptIds = body.addOns.map((addOn) => addOn.id).filter((id): id is string => Boolean(id));

    await this.prisma.$transaction(async (tx) => {
      // Soft-delete what was dropped: a booking that includes an extra keeps a
      // foreign key to it, and its name and price are copied onto the booking
      // anyway, so the history survives.
      await tx.addOn.updateMany({
        where: { venueId, deletedAt: null, ...(keptIds.length ? { id: { notIn: keptIds } } : {}) },
        data: { deletedAt: new Date() },
      });

      for (const [position, addOn] of body.addOns.entries()) {
        const fields = {
          code: addOn.code,
          name: addOn.name,
          description: addOn.description,
          priceAmd: addOn.priceAmd,
          mandatory: addOn.mandatory,
          position,
          deletedAt: null,
        };

        /**
         * An `id` means "this existing extra", so it selects the row — matching
         * on `code` instead would turn a renamed code into a second extra and
         * leave the host with two of something they meant to have one of. No
         * id means a new extra, and then `code` is the natural key: upserting
         * revives one that was soft-deleted rather than colliding with it.
         *
         * `updateMany` keeps the venue scope in the `where`, so an id belonging
         * to somebody else's venue matches nothing.
         */
        if (addOn.id) {
          const { count } = await tx.addOn.updateMany({
            where: { id: addOn.id, venueId },
            data: fields,
          });
          if (count === 0) throw AppError.notFound('Add-on');
          continue;
        }

        await tx.addOn.upsert({
          where: { venueId_code: { venueId, code: addOn.code } },
          create: { venueId, ...fields },
          update: fields,
        });
      }
    });

    return this.detail(userId, venueId);
  }

  /* ── Photos ─────────────────────────────────────────────────────────── */

  async addPhoto(userId: string, venueId: string, body: AddVenuePhotoBody): Promise<HostVenue> {
    await this.ownedVenue(userId, venueId);

    const count = await this.prisma.venueImage.count({ where: { venueId } });
    if (count >= 40) {
      throw new AppError(ErrorCode.CONFLICT, 'A venue can have up to 40 photos');
    }

    await this.prisma.venueImage.create({
      data: {
        venueId,
        // Built from the storage key rather than taken from the client, so a
        // caller cannot point a venue photo at an arbitrary URL.
        url: this.storage.publicUrl(body.key),
        width: body.width,
        height: body.height,
        blurhash: body.blurhash,
        position: count,
      },
    });

    return this.detail(userId, venueId);
  }

  async removePhoto(userId: string, venueId: string, photoId: string): Promise<HostVenue> {
    const venue = await this.ownedVenue(userId, venueId);

    const photo = await this.prisma.venueImage.findFirst({ where: { id: photoId, venueId } });
    if (!photo) throw AppError.notFound('Photo');

    /**
     * `publishBlockers` is checked when a venue goes live, and removing its last
     * photo is the one way to walk back through that gate afterwards: search
     * filters on status alone, so the listing would stay in results with an
     * empty card — precisely the state the publish rule exists to prevent.
     *
     * Refused rather than silently unpublished, because a host swapping a photo
     * should not discover later that their hall vanished from search. Add the
     * replacement first, or pause the listing.
     */
    if (venue.status === VenueStatus.PUBLISHED) {
      const remaining = await this.prisma.venueImage.count({ where: { venueId } });
      if (remaining <= 1) {
        throw new AppError(
          ErrorCode.CONFLICT,
          'A published venue needs at least one photo — add another before removing this one, or pause the listing',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.venueImage.delete({ where: { id: photoId } });
      // Close the gap so positions stay 0..n-1 and "first is the cover" holds.
      const remaining = await tx.venueImage.findMany({
        where: { venueId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (const [position, image] of remaining.entries()) {
        await tx.venueImage.update({ where: { id: image.id }, data: { position } });
      }
    });

    return this.detail(userId, venueId);
  }

  async reorderPhotos(
    userId: string,
    venueId: string,
    body: ReorderVenuePhotosBody,
  ): Promise<HostVenue> {
    await this.ownedVenue(userId, venueId);

    const existing = await this.prisma.venueImage.findMany({
      where: { venueId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((image) => image.id));

    // A partial list would silently leave photos at stale positions, so the
    // order has to name every one of them — exactly once. Distinctness is
    // checked again here rather than left to the schema, because "same length
    // and every id belongs to this venue" is satisfied by a list that repeats
    // one photo and omits another, and that list reorders the wrong things.
    const distinctIds = new Set(body.ids);
    const sameSet =
      distinctIds.size === body.ids.length &&
      body.ids.length === existingIds.size &&
      body.ids.every((id) => existingIds.has(id));
    if (!sameSet) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'Send every photo id for this venue, in the order you want them',
      );
    }

    await this.prisma.$transaction(
      body.ids.map((id, position) =>
        this.prisma.venueImage.update({ where: { id }, data: { position } }),
      ),
    );

    return this.detail(userId, venueId);
  }

  /* ── Calendar ───────────────────────────────────────────────────────── */

  /**
   * Close dates, or price them differently.
   *
   * A date somebody has booked cannot be closed from here: the booking is the
   * agreement, and making it disappear by editing a calendar would be the
   * wrong way to break it. The response says which dates were refused.
   */
  async blockDates(
    userId: string,
    venueId: string,
    body: BlockDatesBody,
  ): Promise<{ updated: number; skipped: string[] }> {
    await this.ownedVenue(userId, venueId);

    const dates = eachDate(body.from, body.to);
    if (dates.length > MAX_BLOCK_DAYS) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `That range covers ${dates.length} days; ${MAX_BLOCK_DAYS} is the most in one go`,
      );
    }

    const slots = (body.slots ?? ALL_SLOTS) as TimeSlot[];

    /**
     * A price and a closure are the two things this endpoint does, and they are
     * opposites: `priceAmd` means "sell these dates at this instead", so it
     * opens them. Leaving the status alone when a price was given would let a
     * host put a New Year rate on a day they had closed and quietly keep it
     * closed, with the calendar showing a price nobody can pay.
     */
    const status =
      body.priceAmd === undefined ? AvailabilityStatus.BLOCKED : AvailabilityStatus.OPEN;

    const taken = await this.prisma.venueAvailability.findMany({
      where: {
        venueId,
        date: { gte: fromIsoDate(body.from), lte: fromIsoDate(body.to) },
        slot: { in: slots },
        status: { in: [AvailabilityStatus.BOOKED, AvailabilityStatus.HELD] },
      },
      select: { date: true, slot: true },
    });
    const blocked = new Set(
      taken.map((row) => `${row.date.toISOString().slice(0, 10)}:${row.slot}`),
    );

    const skipped: string[] = [];
    const rows: {
      venueId: string;
      date: Date;
      slot: TimeSlot;
      status: AvailabilityStatus;
      priceAmd: number | null;
      note: string | null;
    }[] = [];

    for (const date of dates) {
      for (const slot of slots) {
        if (blocked.has(`${date}:${slot}`)) {
          skipped.push(`${date} ${slot.toLowerCase()}`);
          continue;
        }
        rows.push({
          venueId,
          date: fromIsoDate(date),
          slot,
          status,
          priceAmd: body.priceAmd ?? null,
          note: body.note ?? null,
        });
      }
    }

    if (rows.length === 0) return { updated: 0, skipped };

    /**
     * Two statements instead of a row-at-a-time loop. "Close all of August" is
     * 124 upserts, and a connection that drops halfway through leaves the host
     * with a half-closed month they have no way to see: the request failed, so
     * their calendar still shows it open, and guests can book the rest of it.
     * As one transaction it either all lands or none of it does.
     *
     * `createMany` writes the dates that had no row; `updateMany` then applies
     * the same change to the ones that did. Re-stating the BOOKED/HELD
     * exclusion in its `where` — rather than listing the pairs found above —
     * also closes the gap between the read and the write: a date booked in
     * between is skipped by the database rather than by a stale set.
     */
    await this.prisma.$transaction([
      this.prisma.venueAvailability.createMany({ data: rows, skipDuplicates: true }),
      this.prisma.venueAvailability.updateMany({
        where: {
          venueId,
          date: { gte: fromIsoDate(body.from), lte: fromIsoDate(body.to) },
          slot: { in: slots },
          status: { notIn: [AvailabilityStatus.BOOKED, AvailabilityStatus.HELD] },
        },
        data: {
          status,
          ...(body.priceAmd !== undefined ? { priceAmd: body.priceAmd } : {}),
          ...(body.note !== undefined ? { note: body.note } : {}),
        },
      }),
    ]);

    return { updated: rows.length, skipped };
  }

  /**
   * Reopen dates, and drop any one-off price with them.
   *
   * "Closed" is not the only thing this undoes: a date carrying a New Year rate
   * is OPEN, so matching on BLOCKED alone would make that price permanent —
   * there is no other route that clears it. The rule is therefore "anything the
   * host set on a date nobody has taken", and a BOOKED or HELD date is left
   * exactly as it is.
   */
  async unblockDates(
    userId: string,
    venueId: string,
    body: UnblockDatesBody,
  ): Promise<{ updated: number }> {
    await this.ownedVenue(userId, venueId);

    const slots = (body.slots ?? ALL_SLOTS) as TimeSlot[];

    const { count } = await this.prisma.venueAvailability.updateMany({
      where: {
        venueId,
        date: { gte: fromIsoDate(body.from), lte: fromIsoDate(body.to) },
        slot: { in: slots },
        status: { notIn: [AvailabilityStatus.BOOKED, AvailabilityStatus.HELD] },
        // Rows with nothing to undo are left alone, so `updated` counts dates
        // that actually changed rather than every day in the range.
        OR: [
          { status: AvailabilityStatus.BLOCKED },
          { priceAmd: { not: null } },
          { note: { not: null } },
        ],
      },
      data: { status: AvailabilityStatus.OPEN, priceAmd: null, note: null },
    });

    return { updated: count };
  }

  /* ── Helpers ────────────────────────────────────────────────────────── */

  private async bookingCounts(
    venueIds: string[],
  ): Promise<Map<string, { upcoming: number; pending: number }>> {
    const counts = new Map<string, { upcoming: number; pending: number }>();
    if (venueIds.length === 0) return counts;

    const today = fromIsoDate(todayInYerevan());

    const [upcoming, pending] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['venueId'],
        where: {
          venueId: { in: venueIds },
          status: { in: [...BLOCKING_BOOKING_STATUSES] },
          eventDate: { gte: today },
        },
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['venueId'],
        where: { venueId: { in: venueIds }, status: 'PENDING_HOST' },
        _count: { _all: true },
      }),
    ]);

    for (const venueId of venueIds) counts.set(venueId, { upcoming: 0, pending: 0 });
    for (const row of upcoming) {
      const entry = counts.get(row.venueId);
      if (entry) entry.upcoming = row._count._all;
    }
    for (const row of pending) {
      const entry = counts.get(row.venueId);
      if (entry) entry.pending = row._count._all;
    }

    return counts;
  }

  /** `Dvin Hall` → `dvin-hall`, then `dvin-hall-2` if that is taken. */
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'venue';

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const clash = await this.prisma.venue.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }

    return `${base}-${Date.now().toString(36)}`;
  }
}

/** "Marine Kirakosyan" → "Marine K." — how hosts are shown to guests. */
function shortenName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  if (!first) return 'Host';
  return last ? `${first} ${[...last][0]?.toUpperCase()}.` : first;
}
