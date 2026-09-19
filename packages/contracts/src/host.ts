import { z } from 'zod';
import {
  amdSchema,
  geoPointSchema,
  idSchema,
  isoDateSchema,
  paginationQuerySchema,
} from './common';
import { amenityCodeSchema, timeSlotSchema, venueTypeSchema } from './enums';
import { venueDetailSchema, venueSummarySchema } from './venue';

/**
 * Host-side venue management.
 *
 * A venue is created as a DRAFT and the host publishes it themselves — Zal is
 * self-serve. `VenueStatus` already carries the states a moderated flow would
 * need, so turning this into "an admin publishes" later is a change to one
 * guard rather than a migration.
 *
 * Nothing here is reachable without the HOST role *and* ownership of the venue
 * in question: the role says what kind of thing you may do, the ownership check
 * says which rows you may do it to, and neither alone is enough.
 */

export const VenueStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export const venueStatusSchema = z.nativeEnum(VenueStatus);
export type VenueStatus = z.infer<typeof venueStatusSchema>;

export const createVenueSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: venueTypeSchema,
  description: z.string().trim().min(40).max(4000),

  addressLine: z.string().trim().min(3).max(160),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80).default('Yerevan'),
  point: geoPointSchema.nullable().default(null),

  capacityMax: z.number().int().positive().max(5000),
  capacityMin: z.number().int().positive().max(5000).nullable().default(null),
  areaSqm: z.number().int().positive().max(100_000).nullable().default(null),
  parkingSpots: z.number().int().min(0).max(5000).nullable().default(null),

  amenities: z.array(amenityCodeSchema).max(20).default([]),
});
export type CreateVenueBody = z.infer<typeof createVenueSchema>;

/** Every field optional, but at least one present — an empty PATCH is a mistake. */
export const updateVenueSchema = createVenueSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
export type UpdateVenueBody = z.infer<typeof updateVenueSchema>;

/**
 * Prices, set per slot.
 *
 * Sent as a complete list rather than one slot at a time: a hall priced for the
 * evening but not the afternoon is a half-configured venue, and making the host
 * send both makes that state hard to reach by accident.
 */
export const setVenuePricesSchema = z.object({
  prices: z
    .array(
      z.object({
        slot: timeSlotSchema,
        priceAmd: amdSchema.refine((value) => value > 0, 'Set a price above zero'),
        weekendPriceAmd: amdSchema.nullable().default(null),
      }),
    )
    .min(1)
    .max(2)
    .refine(
      (prices) => new Set(prices.map((price) => price.slot)).size === prices.length,
      'Each slot can only be priced once',
    ),
});
export type SetVenuePricesBody = z.infer<typeof setVenuePricesSchema>;

/**
 * Close dates, or reopen them.
 *
 * A range plus optional slots, because "we are closed all of August" is the
 * common case and asking for thirty-one separate calls would invite half of
 * them to fail.
 */
export const blockDatesSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    /** Omit to affect both slots. */
    slots: z.array(timeSlotSchema).min(1).max(2).optional(),
    note: z.string().trim().max(200).optional(),
    /** A one-off price for these dates instead of closing them. */
    priceAmd: amdSchema.optional(),
  })
  .refine((body) => body.from <= body.to, 'The end date cannot be before the start date');
export type BlockDatesBody = z.infer<typeof blockDatesSchema>;

export const unblockDatesSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    slots: z.array(timeSlotSchema).min(1).max(2).optional(),
  })
  .refine((body) => body.from <= body.to, 'The end date cannot be before the start date');
export type UnblockDatesBody = z.infer<typeof unblockDatesSchema>;

export const addVenuePhotoSchema = z.object({
  /** The storage key returned by `POST /uploads/presign`. */
  key: z.string().min(1).max(512),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  blurhash: z.string().max(64).nullable().default(null),
});
export type AddVenuePhotoBody = z.infer<typeof addVenuePhotoSchema>;

export const reorderVenuePhotosSchema = z.object({
  /** Every photo id, in the order they should appear. The first is the cover. */
  ids: z.array(idSchema).min(1).max(40),
});
export type ReorderVenuePhotosBody = z.infer<typeof reorderVenuePhotosSchema>;

export const setVenueAddOnsSchema = z.object({
  addOns: z
    .array(
      z.object({
        /** Omit for a new extra; supply it to update one that exists. */
        id: idSchema.optional(),
        code: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .regex(/^[A-Z0-9_]+$/, 'Use an uppercase code like PHOTOGRAPHY'),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(400).nullable().default(null),
        priceAmd: amdSchema,
        mandatory: z.boolean().default(false),
      }),
    )
    .max(20),
});
export type SetVenueAddOnsBody = z.infer<typeof setVenueAddOnsSchema>;

/**
 * Publishing and pausing.
 *
 * ARCHIVED is deliberately absent: it is reached through DELETE, which also
 * checks for live bookings. Allowing it here would let a host archive a venue
 * somebody has paid a deposit on with a one-word PATCH.
 */
export const setVenueStatusSchema = z.object({
  status: z.enum([VenueStatus.DRAFT, VenueStatus.PUBLISHED, VenueStatus.PAUSED]),
});
export type SetVenueStatusBody = z.infer<typeof setVenueStatusSchema>;

/** A venue as its host sees it: the guest view plus what is not public yet. */
export const hostVenueSchema = venueDetailSchema.extend({
  status: venueStatusSchema,
  /** Reasons the venue cannot be published yet; empty means it is ready. */
  publishBlockers: z.array(z.string()),
  upcomingBookings: z.number().int().min(0),
});
export type HostVenue = z.infer<typeof hostVenueSchema>;

export const hostVenueSummarySchema = venueSummarySchema.extend({
  status: venueStatusSchema,
  upcomingBookings: z.number().int().min(0),
  pendingBookings: z.number().int().min(0),
});
export type HostVenueSummary = z.infer<typeof hostVenueSummarySchema>;

export const listHostVenuesQuerySchema = paginationQuerySchema.extend({
  status: venueStatusSchema.optional(),
});
export type ListHostVenuesQuery = z.infer<typeof listHostVenuesQuerySchema>;

export const listHostBookingsQuerySchema = paginationQuerySchema.extend({
  venueId: idSchema.optional(),
  /** Only the ones waiting on this host to decide. */
  pendingOnly: z.coerce.boolean().default(false),
});
export type ListHostBookingsQuery = z.infer<typeof listHostBookingsQuerySchema>;
