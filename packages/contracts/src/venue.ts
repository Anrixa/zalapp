import { z } from 'zod';
import {
  addressSchema,
  amdSchema,
  idSchema,
  imageSchema,
  isoDateSchema,
  paginationQuerySchema,
} from './common';
import {
  amenityCodeSchema,
  availabilityStatusSchema,
  eventTypeSchema,
  timeSlotSchema,
  venueSortSchema,
  venueTypeSchema,
} from './enums';
import { hostSchema } from './user';

/** What a venue card needs and nothing more — list endpoints return this. */
export const venueSummarySchema = z.object({
  id: idSchema,
  slug: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  type: venueTypeSchema,
  district: z.string().min(1).max(80),
  city: z.string().min(1).max(80),
  capacityMax: z.number().int().positive(),
  /** Lowest slot price across the venue's slots, for "from" pricing on cards. */
  fromPriceAmd: amdSchema,
  ratingAvg: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0),
  coverImage: imageSchema.nullable(),
  /** Whether the signed-in guest has saved it. `false` when nobody is signed in. */
  isSaved: z.boolean().default(false),
});
export type VenueSummary = z.infer<typeof venueSummarySchema>;

export const amenitySchema = z.object({
  code: amenityCodeSchema,
  label: z.string().min(1).max(80),
});
export type Amenity = z.infer<typeof amenitySchema>;

/** An optional extra offered at checkout: DJ, photography, floral styling. */
export const addOnSchema = z.object({
  id: idSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(400).nullable(),
  priceAmd: amdSchema,
  /** Extras a venue always includes are shown but cannot be switched off. */
  mandatory: z.boolean().default(false),
});
export type AddOn = z.infer<typeof addOnSchema>;

/** Per-slot pricing. A Saturday evening is not a Tuesday afternoon. */
export const venuePriceSchema = z.object({
  slot: timeSlotSchema,
  priceAmd: amdSchema,
  /** Optional multiplier on Fri/Sat/Sun, expressed as a resolved price instead. */
  weekendPriceAmd: amdSchema.nullable().default(null),
});
export type VenuePrice = z.infer<typeof venuePriceSchema>;

export const venueDetailSchema = venueSummarySchema.extend({
  description: z.string().max(4000),
  address: addressSchema,
  areaSqm: z.number().int().positive().nullable(),
  parkingSpots: z.number().int().min(0).nullable(),
  capacityMin: z.number().int().positive().nullable(),
  depositRate: z.number().min(0).max(1),
  images: z.array(imageSchema),
  amenities: z.array(amenitySchema),
  addOns: z.array(addOnSchema),
  prices: z.array(venuePriceSchema),
  host: hostSchema,
  /** Rating split 5→1, for the histogram under Reviews. */
  ratingBreakdown: z.record(z.enum(['1', '2', '3', '4', '5']), z.number().int().min(0)),
  cancellationPolicy: z.object({
    freeUntilDaysBefore: z.number().int().min(0),
    note: z.string().max(400),
  }),
});
export type VenueDetail = z.infer<typeof venueDetailSchema>;

/**
 * Search and filters.
 *
 * Everything on the Filters sheet maps to a query parameter, so a filtered
 * result set is a URL — shareable on web, restorable on mobile, and cacheable
 * by React Query without a bespoke key.
 */
export const venueSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  types: z
    .union([venueTypeSchema, z.array(venueTypeSchema)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  amenities: z
    .union([amenityCodeSchema, z.array(amenityCodeSchema)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  minPriceAmd: z.coerce.number().int().min(0).optional(),
  maxPriceAmd: z.coerce.number().int().min(0).optional(),
  minCapacity: z.coerce.number().int().min(0).optional(),
  maxCapacity: z.coerce.number().int().min(0).optional(),
  /** Only venues open on this date, optionally for one slot. */
  date: isoDateSchema.optional(),
  slot: timeSlotSchema.optional(),
  eventType: eventTypeSchema.optional(),
  sort: venueSortSchema.default('RECOMMENDED'),
});
export type VenueSearchQuery = z.infer<typeof venueSearchQuerySchema>;

/** Facet counts so the Filters sheet can grey out options that return nothing. */
export const venueSearchFacetsSchema = z.object({
  types: z.array(z.object({ type: venueTypeSchema, count: z.number().int().min(0) })),
  amenities: z.array(z.object({ code: amenityCodeSchema, count: z.number().int().min(0) })),
  priceRangeAmd: z.object({ min: amdSchema, max: amdSchema }),
  capacityRange: z.object({ min: z.number().int(), max: z.number().int() }),
});
export type VenueSearchFacets = z.infer<typeof venueSearchFacetsSchema>;

export const venueSearchResultSchema = z.object({
  items: z.array(venueSummarySchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().min(0),
  facets: venueSearchFacetsSchema,
});
export type VenueSearchResult = z.infer<typeof venueSearchResultSchema>;

/** The Home screen in a single request — three shelves plus the promo banner. */
export const discoverSchema = z.object({
  featured: z.array(venueSummarySchema),
  openThisWeekend: z.array(venueSummarySchema),
  nearby: z.array(venueSummarySchema),
  promo: z
    .object({
      eyebrow: z.string().max(60),
      title: z.string().max(120),
      href: z.string().max(200).nullable(),
    })
    .nullable(),
});
export type Discover = z.infer<typeof discoverSchema>;

/* ── Availability ───────────────────────────────────────────────────────── */

export const slotAvailabilitySchema = z.object({
  slot: timeSlotSchema,
  status: availabilityStatusSchema,
  priceAmd: amdSchema,
});
export type SlotAvailability = z.infer<typeof slotAvailabilitySchema>;

export const dayAvailabilitySchema = z.object({
  date: isoDateSchema,
  slots: z.array(slotAvailabilitySchema),
  /** Convenience for the calendar grid: true when no slot is bookable. */
  fullyBooked: z.boolean(),
});
export type DayAvailability = z.infer<typeof dayAvailabilitySchema>;

/** The calendar asks for one month at a time. */
export const availabilityQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const availabilityResponseSchema = z.object({
  venueId: idSchema,
  days: z.array(dayAvailabilitySchema),
});
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

/**
 * A live quote for one date/slot/guest-count/add-on combination.
 *
 * The Checkout screen asks for this instead of doing the arithmetic itself, so
 * a price override on a particular Saturday is reflected without the client
 * knowing the rule exists.
 */
export const quoteRequestSchema = z.object({
  date: isoDateSchema,
  slot: timeSlotSchema,
  guestCount: z.number().int().positive().max(5000),
  addOnIds: z.array(idSchema).max(20).default([]),
  promoCode: z.string().trim().max(32).optional(),
});
export type QuoteRequestBody = z.infer<typeof quoteRequestSchema>;
