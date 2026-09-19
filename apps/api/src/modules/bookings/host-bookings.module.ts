import { Module } from '@nestjs/common';
import { HostBookingsService } from './host-bookings.service';

/**
 * Split out so VenuesModule can mount the host controller without importing
 * the booking write path, which would create a cycle.
 */
@Module({
  providers: [HostBookingsService],
  exports: [HostBookingsService],
})
export class HostBookingsModule {}
