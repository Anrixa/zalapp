import { Injectable } from '@nestjs/common';
import type { Favorite, FavoriteState, Page } from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { toVenueSummary } from '../venues/venue.mapper';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: { cursor?: string; limit: number }): Promise<Page<Favorite>> {
    const cursorId = decodeCursor(query.cursor);

    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        venue: { include: { images: { orderBy: { position: 'asc' }, take: 1 }, prices: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { venueId: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { userId_venueId: { userId, venueId: cursorId } }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.venueId);

    return {
      items: items.map((row) => ({
        venue: toVenueSummary(row.venue, { isSaved: true }),
        savedAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  /**
   * One endpoint for save and unsave.
   *
   * A heart is a toggle in the UI, so making it a toggle in the API removes the
   * class of bug where a double tap on a slow connection leaves the two out of
   * step. The response says what the state now *is*, so the client can settle
   * on the truth rather than on what it assumed.
   */
  async toggle(userId: string, venueId: string): Promise<FavoriteState> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, deletedAt: null },
      select: { id: true },
    });
    if (!venue) throw AppError.notFound('Venue');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });

    const savedCount = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.favorite.delete({ where: { userId_venueId: { userId, venueId } } });
      } else {
        await tx.favorite.create({ data: { userId, venueId } });
      }

      // Recount rather than increment: the counter is a cache of the rows, and
      // recomputing it here keeps a failed write from leaving it permanently off.
      const count = await tx.favorite.count({ where: { venueId } });
      await tx.venue.update({ where: { id: venueId }, data: { savedCount: count } });
      return count;
    });

    return { venueId, isSaved: !existing, savedCount };
  }

  async remove(userId: string, venueId: string): Promise<FavoriteState> {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });
    if (!existing) {
      const savedCount = await this.prisma.favorite.count({ where: { venueId } });
      return { venueId, isSaved: false, savedCount };
    }
    return this.toggle(userId, venueId);
  }
}
