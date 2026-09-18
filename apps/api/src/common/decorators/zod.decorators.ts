import { Body, Param, Query } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/** `@ZodBody(createBookingSchema) body: CreateBookingBody` */
export const ZodBody = (schema: ZodSchema) => Body(new ZodValidationPipe(schema));

/** `@ZodQuery(venueSearchQuerySchema) query: VenueSearchQuery` */
export const ZodQuery = (schema: ZodSchema) => Query(new ZodValidationPipe(schema));

/** `@ZodParam('id', idSchema) id: string` */
export const ZodParam = (name: string, schema: ZodSchema) =>
  Param(name, new ZodValidationPipe(schema));
