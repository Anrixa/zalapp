import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ReviewsModule } from './reviews.module';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [VenuesModule, ReviewsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
