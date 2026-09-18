import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { ErrorCode } from '@zal/contracts';
import { AppError } from '../errors/app-error';

/**
 * Validate a request part against a schema from `@zal/contracts`.
 *
 * The schema is the same object the clients use to build the request, so the
 * API is validating against the published contract rather than a hand-written
 * DTO that can quietly drift from it.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Some of the details need fixing', {
          fields: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
      throw error;
    }
  }
}
