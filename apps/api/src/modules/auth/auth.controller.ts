import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  type AuthSession,
  type TokenPair,
  type VerificationChallenge,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  logoutSchema,
  otpRequestSchema,
  otpResendSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@zal/contracts';
import { ZodBody } from '../../common/decorators/zod.decorators';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AppError } from '../../common/errors/app-error';
import { AuthService } from './auth.service';
import { loadEnv } from '../../config/env';

/**
 * Where the refresh token lives depends on the client.
 *
 * A browser cannot keep a secret from its own JavaScript, so on web the refresh
 * token is set as an httpOnly cookie and never appears in a response body — XSS
 * then cannot read it. A native app has a real keychain, so it gets the token in
 * the body and stores it there. One header decides which, and both paths share
 * every line of the logic underneath.
 */
const REFRESH_COOKIE = 'zal_rt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly env = loadEnv();

  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create an account and send an SMS code' })
  register(@ZodBody(registerSchema) body: unknown): Promise<VerificationChallenge> {
    return this.auth.register(body as never);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Log in with phone or email and password' })
  async login(
    @ZodBody(loginSchema) body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.login(body as never, contextFrom(request));
    return this.deliver(session, request, response);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/request')
  @ApiOperation({ summary: 'Send a one-time code by SMS' })
  requestOtp(@ZodBody(otpRequestSchema) body: unknown): Promise<VerificationChallenge> {
    return this.auth.requestOtp(body as never);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/resend')
  resendOtp(@ZodBody(otpResendSchema) body: { verificationId: string }) {
    return this.auth.resendOtp(body.verificationId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/verify')
  @ApiOperation({ summary: 'Exchange a verification code for a session' })
  async verifyOtp(
    @ZodBody(otpVerifySchema) body: { verificationId: string; code: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.verifyOtp(body.verificationId, body.code, contextFrom(request));
    return this.deliver(session, request, response);
  }

  @Public()
  @HttpCode(200)
  @Post('google')
  async google(
    @ZodBody(googleSignInSchema) body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.googleSignIn(body as never, contextFrom(request));
    return this.deliver(session, request, response);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token and get a new access token' })
  async refresh(
    @ZodBody(refreshSchema) body: { refreshToken?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenPair> {
    const token = body.refreshToken ?? readRefreshCookie(request);
    if (!token) throw AppError.unauthenticated('No refresh token supplied');

    const pair = await this.auth.refresh(token, contextFrom(request));
    return this.deliverTokens(pair, request, response);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(
    @ZodBody(logoutSchema) body: { refreshToken?: string; allDevices: boolean },
    @CurrentUser('id') userId: string | null,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = body.refreshToken ?? readRefreshCookie(request);
    await this.auth.logout(token, userId, body.allDevices);
    response.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/forgot')
  forgotPassword(@ZodBody(forgotPasswordSchema) body: unknown): Promise<VerificationChallenge> {
    return this.auth.forgotPassword(body as never);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/reset')
  resetPassword(@ZodBody(resetPasswordSchema) body: unknown): Promise<{ ok: true }> {
    return this.auth.resetPassword(body as never);
  }

  /** Move the refresh token into a cookie for web callers; leave it in place for native. */
  private deliver(session: AuthSession, request: Request, response: Response): AuthSession {
    if (!isWebClient(request)) return session;
    this.setRefreshCookie(response, session.refreshToken);
    return { ...session, refreshToken: undefined };
  }

  private deliverTokens(pair: TokenPair, request: Request, response: Response): TokenPair {
    if (!isWebClient(request)) return pair;
    this.setRefreshCookie(response, pair.refreshToken);
    return { ...pair, refreshToken: undefined };
  }

  private setRefreshCookie(response: Response, token: string | undefined): void {
    if (!token) return;
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.env.JWT_REFRESH_TTL * 1000,
    });
  }
}

/**
 * Web unless a client says otherwise.
 *
 * Defaulting to the cookie is the safe direction: a misconfigured native client
 * gets an unusable cookie and a loud bug, whereas defaulting to the body would
 * hand a browser a token it cannot protect.
 */
function isWebClient(request: Request): boolean {
  const header = request.headers['x-zal-client'];
  const value = Array.isArray(header) ? header[0] : header;
  return (value ?? 'web').toLowerCase() === 'web';
}

function readRefreshCookie(request: Request): string | undefined {
  return (request as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
}

function contextFrom(request: Request) {
  return {
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  };
}

// Re-exported so `me` endpoints that rotate credentials can clear the same cookie.
export { REFRESH_COOKIE };
export type { AuthenticatedUser };
