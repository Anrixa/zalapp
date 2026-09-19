import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { AvailabilityService } from './availability.service';
import { HostVenuesController } from './host-venues.controller';
import { HostVenuesService } from './host-venues.service';
import { ReviewsModule } from '../bookings/reviews.module';
import { HostBookingsModule } from '../bookings/host-bookings.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [ReviewsModule, HostBookingsModule, UploadsModule],
  controllers: [VenuesController, HostVenuesController],
  providers: [VenuesService, AvailabilityService, HostVenuesService],
  exports: [VenuesService, AvailabilityService],
})
export class VenuesModule {}
