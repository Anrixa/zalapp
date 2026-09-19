import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addVenuePhotoSchema,
  blockDatesSchema,
  createVenueSchema,
  listHostBookingsQuerySchema,
  listHostVenuesQuerySchema,
  reorderVenuePhotosSchema,
  setVenueAddOnsSchema,
  setVenuePricesSchema,
  setVenueStatusSchema,
  unblockDatesSchema,
  updateVenueSchema,
} from '@zal/contracts';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { HostVenuesService } from './host-venues.service';
import { HostBookingsService } from '../bookings/host-bookings.service';

/**
 * Host-side venue management.
 *
 * Everything here is authenticated, and everything except `create` also
 * requires the HOST role — `create` is what turns a guest into a host, so
 * demanding the role first would make the first venue impossible to list.
 *
 * The role is only half the check. Each handler's service call verifies that
 * the venue belongs to the caller, because a host with a valid token is still
 * not allowed near another host's calendar.
 */
@ApiTags('host')
@ApiBearerAuth()
@Controller('host')
export class HostVenuesController {
  constructor(
    private readonly hostVenues: HostVenuesService,
    private readonly hostBookings: HostBookingsService,
  ) {}

  @Post('venues')
  @ApiOperation({ summary: 'List a new venue as a draft (creates a host profile if needed)' })
  create(@CurrentUser('id') userId: string, @ZodBody(createVenueSchema) body: unknown) {
    return this.hostVenues.create(userId, body as never);
  }

  @Roles('HOST')
  @Get('venues')
  list(@CurrentUser('id') userId: string, @ZodQuery(listHostVenuesQuerySchema) query: unknown) {
    return this.hostVenues.list(userId, query as never);
  }

  @Roles('HOST')
  @Get('venues/:venueId')
  detail(@CurrentUser('id') userId: string, @Param('venueId') venueId: string) {
    return this.hostVenues.detail(userId, venueId);
  }

  @Roles('HOST')
  @Patch('venues/:venueId')
  update(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(updateVenueSchema) body: unknown,
  ) {
    return this.hostVenues.update(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Patch('venues/:venueId/status')
  @ApiOperation({ summary: 'Publish, pause or unpublish — refused while anything is missing' })
  setStatus(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(setVenueStatusSchema) body: unknown,
  ) {
    return this.hostVenues.setStatus(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Delete('venues/:venueId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive a venue — refused while it has upcoming bookings' })
  archive(@CurrentUser('id') userId: string, @Param('venueId') venueId: string) {
    return this.hostVenues.archive(userId, venueId);
  }

  @Roles('HOST')
  @Put('venues/:venueId/prices')
  setPrices(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(setVenuePricesSchema) body: unknown,
  ) {
    return this.hostVenues.setPrices(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Put('venues/:venueId/add-ons')
  setAddOns(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(setVenueAddOnsSchema) body: unknown,
  ) {
    return this.hostVenues.setAddOns(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Post('venues/:venueId/photos')
  @ApiOperation({ summary: 'Attach an uploaded photo by its storage key' })
  addPhoto(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(addVenuePhotoSchema) body: unknown,
  ) {
    return this.hostVenues.addPhoto(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Put('venues/:venueId/photos/order')
  reorderPhotos(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(reorderVenuePhotosSchema) body: unknown,
  ) {
    return this.hostVenues.reorderPhotos(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Delete('venues/:venueId/photos/:photoId')
  removePhoto(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.hostVenues.removePhoto(userId, venueId, photoId);
  }

  @Roles('HOST')
  @Post('venues/:venueId/blocks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close a date range, or give it a one-off price' })
  blockDates(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @ZodBody(blockDatesSchema) body: unknown,
  ) {
    return this.hostVenues.blockDates(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Delete('venues/:venueId/blocks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reopen a date range the host had closed' })
  unblockDates(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    // A DELETE with a body, because the thing being removed is a range rather
    // than a resource with an id of its own.
    @Body(new ZodValidationPipe(unblockDatesSchema)) body: unknown,
  ) {
    return this.hostVenues.unblockDates(userId, venueId, body as never);
  }

  @Roles('HOST')
  @Get('bookings')
  @ApiOperation({ summary: "Bookings across this host's venues" })
  bookings(
    @CurrentUser('id') userId: string,
    @ZodQuery(listHostBookingsQuerySchema) query: unknown,
  ) {
    return this.hostBookings.list(userId, query as never);
  }
}
