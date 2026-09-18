import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  availabilityQuerySchema,
  listReviewsQuerySchema,
  quoteRequestSchema,
  venueSearchQuerySchema,
} from '@zal/contracts';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VenuesService } from './venues.service';
import { ReviewsService } from '../bookings/reviews.service';

/**
 * Browsing works signed out. `@OptionalAuth()` attaches the guest when a token
 * is present — which is all `isSaved` needs — and lets the same endpoints serve
 * the public web pages that bring people in.
 */
@ApiTags('venues')
@OptionalAuth()
@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venues: VenuesService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('discover')
  @ApiOperation({ summary: 'The Home screen shelves' })
  discover(@CurrentUser('id') userId: string | null) {
    return this.venues.discover(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Search venues with filters and facet counts' })
  search(
    @ZodQuery(venueSearchQuerySchema) query: unknown,
    @CurrentUser('id') userId: string | null,
  ) {
    return this.venues.search(query as never, userId);
  }

  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string, @CurrentUser('id') userId: string | null) {
    return this.venues.detail(idOrSlug, userId);
  }

  @Get(':venueId/availability')
  @ApiOperation({ summary: 'Open dates and per-slot prices for a date range' })
  availability(
    @Param('venueId') venueId: string,
    @ZodQuery(availabilityQuerySchema) query: { from: string; to: string },
  ) {
    return this.venues.availabilityFor(venueId, query.from, query.to);
  }

  @Post(':venueId/quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Price a booking without creating it' })
  quote(@Param('venueId') venueId: string, @ZodBody(quoteRequestSchema) body: unknown) {
    return this.venues.quote(venueId, body as never);
  }

  @Get(':venueId/reviews')
  reviewsFor(@Param('venueId') venueId: string, @ZodQuery(listReviewsQuerySchema) query: unknown) {
    return this.reviews.listForVenue(venueId, query as never);
  }
}
