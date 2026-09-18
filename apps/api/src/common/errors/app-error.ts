import { HttpException } from '@nestjs/common';
import { ErrorCode, httpStatusForErrorCode } from '@zal/contracts';

/**
 * Every deliberate failure in the API is one of these.
 *
 * Throwing `AppError` rather than a bare HttpException guarantees the response
 * carries a stable machine code the clients can branch on, and that the status
 * code is derived from that code in one place instead of being chosen ad hoc at
 * each throw site.
 */
export class AppError extends HttpException {
  readonly code: string;
  readonly fields?: { path: string; message: string }[];
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode | string,
    message: string,
    options: {
      fields?: { path: string; message: string }[];
      retryAfter?: number;
      status?: number;
    } = {},
  ) {
    const status = options.status ?? httpStatusForErrorCode(code);
    super({ error: { code, message } }, status);
    this.code = code;
    this.fields = options.fields;
    this.retryAfter = options.retryAfter;
  }

  static notFound(what = 'Resource'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, `${what} not found`);
  }

  static forbidden(message = 'You do not have access to this'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }

  static unauthenticated(message = 'Sign in to continue'): AppError {
    return new AppError(ErrorCode.UNAUTHENTICATED, message);
  }

  static conflict(code: ErrorCode | string, message: string): AppError {
    return new AppError(code, message);
  }
}
