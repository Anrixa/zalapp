import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  BookingStatus,
  type BookingSummary,
  type ListHostBookingsQuery,
  type Page,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { toBookingSummary } from './booking.mapper';

/**
 * Bookings across a host's venues.
 *
 * Separate from the guest-facing list because the question is different: a
 * guest asks "what have I booked", a host asks "what is coming, and what is
 * waiting on me". The ordering reflects that — soonest first, because a host's
 * list is a work queue rather than a history.
 */
@Injectable()
export class HostBookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListHostBookingsQuery): Promise<Page<BookingSummary>> {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return { items: [], nextCursor: null };

    const cursorId = decodeCursor(query.cursor);

    const where: Prisma.BookingWhereInput = {
      venue: {
        hostProfileId: profile.id,
        // Scoping by host id alone would be enough; naming the venue as well
        // keeps a mistyped id from silently widening the query.
        ...(query.venueId ? { id: query.venueId } : {}),
      },
      ...(query.pendingOnly ? { status: BookingStatus.PENDING_HOST } : {}),
    };

    const rows = await this.prisma.booking.findMany({
      where,
      include: { venue: { include: { images: { orderBy: { position: 'asc' } }, prices: true } } },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.id);
    return { items: items.map((row) => toBookingSummary(row)), nextCursor };
  }
}
