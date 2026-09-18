import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cancelBookingSchema,
  createBookingSchema,
  createReviewSchema,
  hostDecisionSchema,
  listBookingsQuerySchema,
} from '@zal/contracts';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { ReviewsService } from './reviews.service';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My bookings, by tab' })
  list(@CurrentUser('id') userId: string, @ZodQuery(listBookingsQuerySchema) query: unknown) {
    return this.bookings.list(userId, query as never);
  }

  @Post()
  @ApiOperation({ summary: 'Hold a date and price the booking server-side' })
  create(@CurrentUser('id') userId: string, @ZodBody(createBookingSchema) body: unknown) {
    return this.bookings.create(userId, body as never);
  }

  @Get(':bookingId')
  detail(@CurrentUser('id') userId: string, @Param('bookingId') bookingId: string) {
    return this.bookings.detail(userId, bookingId);
  }

  @Post(':bookingId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel and compute the refund from the published policy' })
  cancel(
    @CurrentUser('id') userId: string,
    @Param('bookingId') bookingId: string,
    @ZodBody(cancelBookingSchema) body: unknown,
  ) {
    return this.bookings.cancel(userId, bookingId, body as never);
  }

  @Post(':bookingId/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Host confirms or declines' })
  decide(
    @CurrentUser('id') userId: string,
    @Param('bookingId') bookingId: string,
    @ZodBody(hostDecisionSchema) body: unknown,
  ) {
    return this.bookings.decide(userId, bookingId, body as never);
  }

  @Get(':bookingId/calendar')
  calendar(@CurrentUser('id') userId: string, @Param('bookingId') bookingId: string) {
    return this.bookings.calendarLinks(userId, bookingId);
  }

  @Get(':bookingId/calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="zal-booking.ics"')
  ics(@CurrentUser('id') userId: string, @Param('bookingId') bookingId: string) {
    return this.bookings.icsFor(userId, bookingId);
  }

  @Post(':bookingId/review')
  @ApiOperation({ summary: 'Review a completed booking' })
  review(
    @CurrentUser('id') userId: string,
    @Param('bookingId') bookingId: string,
    @ZodBody(createReviewSchema.omit({ bookingId: true })) body: { rating: number; body?: string },
  ) {
    return this.reviews.create(userId, { ...body, bookingId });
  }
}
