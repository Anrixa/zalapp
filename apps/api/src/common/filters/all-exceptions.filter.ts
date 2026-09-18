import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ErrorCode } from '@zal/contracts';
import { AppError } from '../errors/app-error';

/**
 * The one place an exception becomes a response body.
 *
 * Everything — a thrown AppError, a Zod failure, a Prisma constraint violation,
 * an unexpected TypeError — leaves here in the single envelope described in
 * `@zal/contracts`, so the clients have exactly one error branch to write.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = request.id;

    const { status, body } = this.describe(exception);
    if (requestId) body.error.requestId = requestId;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${body.error.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status} ${body.error.code}`);
    }

    if (body.error.retryAfter) {
      response.setHeader('Retry-After', String(body.error.retryAfter));
    }
    response.status(status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    body: {
      error: {
        code: string;
        message: string;
        fields?: { path: string; message: string }[];
        retryAfter?: number;
        requestId?: string;
      };
    };
  } {
    if (exception instanceof AppError) {
      return {
        status: exception.getStatus(),
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.fields ? { fields: exception.fields } : {}),
            ...(exception.retryAfter ? { retryAfter: exception.retryAfter } : {}),
          },
        },
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Some of the details need fixing',
            fields: exception.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 unique violation, P2025 record not found — the only two that map
      // to something the caller can act on. The rest are our bugs.
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: { error: { code: ErrorCode.CONFLICT, message: 'That already exists' } },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { error: { code: ErrorCode.NOT_FOUND, message: 'Not found' } },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        body: {
          error: {
            code: status === 401 ? ErrorCode.UNAUTHENTICATED : this.codeForStatus(status),
            message: Array.isArray(message) ? message.join('; ') : message,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: ErrorCode.INTERNAL, message: 'Something went wrong on our side' } },
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_FAILED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 429:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL;
    }
  }
}
