import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  ErrorCode,
  type CreateReviewBody,
  type ListReviewsQuery,
  type Page,
  type Review,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { formatMonthYear } from '../../common/utils/dates';
import { initialsFrom } from '../../common/utils/text';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Reviews.
 *
 * Every review is attached to a completed booking made by its author. That is
 * enforced here and by a unique index, which is what lets the venue page say
 * "from real bookings" without qualification — and what keeps a competitor from
 * leaving five one-star reviews on a hall they have never been to.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, body: CreateReviewBody): Promise<Review> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: body.bookingId, userId },
      include: { venue: { select: { id: true, name: true, host: { select: { userId: true } } } } },
    });
    if (!booking) throw AppError.notFound('Booking');

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new AppError(
        ErrorCode.REVIEW_NOT_ALLOWED,
        'You can leave a review once the event has taken place',
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId: booking.id },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(ErrorCode.REVIEW_ALREADY_EXISTS, 'You have already reviewed this booking');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          venueId: booking.venueId,
          userId,
          bookingId: booking.id,
          rating: body.rating,
          body: body.body ?? null,
        },
        include: { user: true, booking: { select: { eventDate: true, eventType: true } } },
      });

      // Recompute from the rows rather than nudging a running average: one
      // deleted review would otherwise leave the venue's rating permanently
      // slightly wrong.
      const stats = await tx.review.aggregate({
        where: { venueId: booking.venueId, deletedAt: null },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.venue.update({
        where: { id: booking.venueId },
        data: {
          ratingAvg: stats._avg.rating ? Math.round(stats._avg.rating * 100) / 100 : null,
          reviewCount: stats._count.rating,
        },
      });

      return created;
    });

    await this.notifications.create({
      userId: booking.venue.host.userId,
      type: 'REVIEW_PUBLISHED',
      title: 'New review',
      body: `${review.rating}★ for ${booking.venue.name}.`,
      data: { venueId: booking.venueId, bookingId: booking.id },
    });

    return {
      id: review.id,
      rating: review.rating,
      body: review.body,
      eventType: review.booking.eventType,
      eventMonth: formatMonthYear(review.booking.eventDate),
      author: {
        id: review.user.id,
        displayName: review.user.fullName,
        initials: initialsFrom(review.user.fullName),
        avatarUrl: review.user.avatarUrl,
      },
      hostReply: review.hostReply,
      createdAt: review.createdAt.toISOString(),
    };
  }

  async listForVenue(venueId: string, query: ListReviewsQuery): Promise<Page<Review>> {
    const cursorId = decodeCursor(query.cursor);

    const rows = await this.prisma.review.findMany({
      where: {
        venueId,
        deletedAt: null,
        ...(query.rating ? { rating: query.rating } : {}),
      },
      include: { user: true, booking: { select: { eventDate: true, eventType: true } } },
      orderBy:
        query.sort === 'HIGHEST'
          ? [{ rating: 'desc' }, { id: 'desc' }]
          : query.sort === 'LOWEST'
            ? [{ rating: 'asc' }, { id: 'desc' }]
            : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.id);

    return {
      items: items.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        eventType: review.booking.eventType,
        eventMonth: formatMonthYear(review.booking.eventDate),
        author: {
          id: review.user.id,
          // Reviews show a first name and an initial, the way the design does:
          // enough to feel like a person, not enough to identify a stranger.
          displayName: shortenName(review.user.fullName),
          initials: initialsFrom(review.user.fullName),
          avatarUrl: review.user.avatarUrl,
        },
        hostReply: review.hostReply,
        createdAt: review.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}

/** "Lilit Hovhannisyan" → "Lilit H." */
function shortenName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  if (!first) return 'Guest';
  return last ? `${first} ${[...last][0]?.toUpperCase()}.` : first;
}
