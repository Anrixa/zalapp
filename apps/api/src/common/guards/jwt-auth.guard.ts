import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { accessTokenClaimsSchema } from '@zal/contracts';
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { AppError } from '../errors/app-error';
import { loadEnv } from '../../config/env';

/**
 * Global authentication.
 *
 * Verifies the access token and puts `{ id, role, sessionId }` on the request.
 * Routes marked `@Public()` skip it entirely; routes marked `@OptionalAuth()`
 * attach the user when a valid token is present and carry on without one.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly env = loadEnv();

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request);

    if (!token) {
      if (isOptional) return true;
      throw AppError.unauthenticated();
    }

    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.env.JWT_ACCESS_SECRET });
      const claims = accessTokenClaimsSchema.parse(payload);
      request.user = { id: claims.sub, role: claims.role, sessionId: claims.sid };
      return true;
    } catch {
      if (isOptional) return true;
      throw AppError.unauthenticated('Your session has expired — sign in again');
    }
  }
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value;
}
