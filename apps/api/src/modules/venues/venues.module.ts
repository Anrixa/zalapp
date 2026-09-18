import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { AvailabilityService } from './availability.service';
import { ReviewsModule } from '../bookings/reviews.module';

@Module({
  imports: [ReviewsModule],
  controllers: [VenuesController],
  providers: [VenuesService, AvailabilityService],
  exports: [VenuesService, AvailabilityService],
})
export class VenuesModule {}
