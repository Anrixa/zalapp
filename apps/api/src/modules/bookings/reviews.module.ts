import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

/**
 * Split out from BookingsModule so VenuesModule can list a venue's reviews
 * without importing the booking write path and creating a cycle.
 */
@Module({
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
