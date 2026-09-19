import { z } from 'zod';

/**
 * Direct-to-storage uploads.
 *
 * The file goes from the device to object storage without passing through the
 * API: a 10 MB wedding photo should not occupy a Node process for the length of
 * its upload. The API only says where it may go, under what name, and for how
 * long that permission lasts.
 *
 * The declared `contentType` and `sizeBytes` are part of what gets signed, so a
 * client that asks to upload a 2 MB JPEG cannot then push a 40 MB video to the
 * same URL — storage rejects it before a byte of it is ours.
 */

export const UploadPurpose = {
  AVATAR: 'AVATAR',
  VENUE_PHOTO: 'VENUE_PHOTO',
} as const;
export const uploadPurposeSchema = z.nativeEnum(UploadPurpose);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

/** What storage will accept. HEIC is here because iPhones default to it. */
export const UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

/** 15 MB. A phone camera exceeds this easily; clients downscale before asking. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const presignRequestSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  purpose: uploadPurposeSchema.default('AVATAR'),
});
export type PresignRequestBody = z.infer<typeof presignRequestSchema>;

export const presignResponseSchema = z.object({
  /** The object's key in the bucket. Send this back when attaching the file. */
  key: z.string().min(1).max(512),
  /** PUT the bytes here, with exactly the headers below. */
  uploadUrl: z.string().url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  /** Where the file will be readable once the upload succeeds. */
  publicUrl: z.string().url(),
  expiresIn: z.number().int().positive(),
});
export type PresignResponse = z.infer<typeof presignResponseSchema>;
