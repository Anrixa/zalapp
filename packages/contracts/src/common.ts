import { z } from 'zod';

/** A CUID2 produced by the database. Loose on purpose — length varies by version. */
export const idSchema = z.string().min(8).max(40);

/**
 * An ISO calendar date with no time and no zone: `2026-09-26`.
 *
 * Event dates are calendar dates, not instants. A wedding on 26 September is on
 * 26 September whether the guest opens the app in Yerevan or in Los Angeles, so
 * the wire format deliberately carries no offset.
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO calendar date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Not a real date');
export type IsoDate = z.infer<typeof isoDateSchema>;

/** An instant, always serialised as UTC ISO-8601. */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Money, in whole AMD.
 *
 * The dram has no subunit in practice, so amounts are plain integers and never
 * floats. Conversions to USD/EUR happen at render time only.
 */
export const amdSchema = z.number().int().min(0).max(1_000_000_000);

/** Armenian mobile number in E.164, e.g. +37477123456. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Enter a phone number in international format, e.g. +374 77 123 456');

export const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Passwords are checked for length only. Composition rules push people towards
 * `Password1!` and a password manager cares about length, not punctuation.
 */
export const passwordSchema = z.string().min(8).max(128);

export const localeHeaderSchema = z.string().max(35).optional();

/** Cursor pagination. Offsets drift while a list is being written to. */
export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().min(0).optional(),
  });
}
export type Page<T> = { items: T[]; nextCursor: string | null; total?: number };

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const addressSchema = z.object({
  line1: z.string().min(1).max(160),
  district: z.string().min(1).max(80),
  city: z.string().min(1).max(80),
  country: z.string().length(2).default('AM'),
  point: geoPointSchema.nullable().default(null),
});
export type Address = z.infer<typeof addressSchema>;

export const imageSchema = z.object({
  id: idSchema,
  url: z.string().url(),
  blurhash: z.string().max(64).nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  position: z.number().int().min(0).default(0),
});
export type Image = z.infer<typeof imageSchema>;

/** Returned by endpoints that have nothing to say beyond "it worked". */
export const okSchema = z.object({ ok: z.literal(true) });
