import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import {
  ErrorCode,
  type AuthSession,
  type ForgotPasswordBody,
  type GoogleSignInBody,
  type LoginBody,
  type OtpRequestBody,
  type RegisterBody,
  type ResetPasswordBody,
  type TokenPair,
  type VerificationChallenge,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { OtpService } from './otp.service';
import { TokenService, type IssueContext } from './token.service';
import { GoogleVerifierService } from './google-verifier.service';
import { toUserDto } from '../users/user.mapper';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly google: GoogleVerifierService,
  ) {}

  /**
   * Create an account and send a code.
   *
   * No session is issued here: the phone is not proved yet. The client gets a
   * challenge, shows the OTP screen, and the session arrives from `verifyOtp`.
   */
  async register(body: RegisterBody): Promise<VerificationChallenge> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone: body.phone }, ...(body.email ? [{ email: body.email }] : [])] },
      select: { id: true, phone: true, email: true, phoneVerifiedAt: true },
    });

    if (existing) {
      // An account that never finished verification is not a taken number — it
      // is an abandoned attempt, and blocking it would strand the owner of the
      // phone permanently.
      if (existing.phone === body.phone && existing.phoneVerifiedAt === null) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: body.fullName,
            email: body.email ?? null,
            passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
            locale: body.locale,
          },
        });
        return this.otp.issue({
          phone: body.phone,
          purpose: 'VERIFY_PHONE',
          userId: existing.id,
        });
      }

      if (existing.phone === body.phone) {
        throw new AppError(
          ErrorCode.PHONE_ALREADY_REGISTERED,
          'That number already has an account — log in instead',
        );
      }
      throw new AppError(
        ErrorCode.EMAIL_ALREADY_REGISTERED,
        'That email already has an account — log in instead',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email ?? null,
        passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
        locale: body.locale,
        notificationPreference: { create: {} },
      },
    });

    return this.otp.issue({ phone: user.phone, purpose: 'VERIFY_PHONE', userId: user.id });
  }

  async login(body: LoginBody, context: IssueContext): Promise<AuthSession> {
    const identifier = body.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ phone: identifier }, { email: identifier.toLowerCase() }],
      },
    });

    // Compare against a dummy hash when the account does not exist, so a
    // missing user and a wrong password take the same time to answer.
    const hash =
      user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(body.password, hash);

    if (!user || !ok) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'That phone or password is not right');
    }

    if (!user.phoneVerifiedAt) {
      throw new AppError(ErrorCode.PHONE_NOT_VERIFIED, 'Verify your phone number first');
    }

    return this.sessionFor(user, context);
  }

  async requestOtp(body: OtpRequestBody): Promise<VerificationChallenge> {
    const user = await this.prisma.user.findFirst({
      where: { phone: body.phone, deletedAt: null },
      select: { id: true },
    });

    if (body.purpose === 'RESET_PASSWORD' && !user) {
      // Do not confirm whether a number is registered. The caller gets the same
      // challenge shape either way and simply never receives a code.
      return {
        verificationId: 'unknown',
        phoneHint: body.phone.replace(/\d(?=\d{3})/g, '•'),
        expiresIn: 300,
        resendAfter: 45,
      };
    }

    if (body.purpose === 'LOGIN' && !user) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'No account for that number yet — create one to continue',
      );
    }

    return this.otp.issue({
      phone: body.phone,
      purpose: body.purpose,
      userId: user?.id ?? null,
    });
  }

  async resendOtp(verificationId: string): Promise<VerificationChallenge> {
    return this.otp.resend(verificationId);
  }

  /**
   * Verify a code and hand back a session.
   *
   * This is the one place a phone becomes verified, whichever flow got here —
   * registration, passwordless login, or a number change.
   */
  async verifyOtp(
    verificationId: string,
    code: string,
    context: IssueContext,
  ): Promise<AuthSession> {
    const proof = await this.otp.verify(verificationId, code);

    const user = await this.prisma.user.findFirst({
      where: { phone: proof.phone, deletedAt: null },
    });
    if (!user) {
      throw AppError.notFound('Account');
    }

    const verified = user.phoneVerifiedAt
      ? user
      : await this.prisma.user.update({
          where: { id: user.id },
          data: { phoneVerifiedAt: new Date() },
        });

    return this.sessionFor(verified, context);
  }

  /**
   * Google sign-in.
   *
   * The ID token is verified against Google's published keys — the client is
   * never trusted to say who it is. A Google account whose verified email
   * already exists is linked rather than duplicated.
   */
  async googleSignIn(body: GoogleSignInBody, context: IssueContext): Promise<AuthSession> {
    const profile = await this.google.verify(body.idToken);

    const existing = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ googleId: profile.sub }, ...(profile.email ? [{ email: profile.email }] : [])],
      },
    });

    if (existing) {
      const user = existing.googleId
        ? existing
        : await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              googleId: profile.sub,
              avatarUrl: existing.avatarUrl ?? profile.picture ?? null,
              emailVerifiedAt: profile.emailVerified ? new Date() : existing.emailVerifiedAt,
            },
          });
      return this.sessionFor(user, context);
    }

    // A Google account proves an email, not a phone. The account is created
    // unverified and the client is expected to collect and verify a number
    // before the first booking — which `PHONE_NOT_VERIFIED` enforces.
    const created = await this.prisma.user.create({
      data: {
        fullName: profile.name ?? 'Zal guest',
        // Placeholder until the guest supplies a real number; unique per user.
        phone: `+000${Date.now().toString().slice(-9)}`,
        email: profile.email ?? null,
        googleId: profile.sub,
        avatarUrl: profile.picture ?? null,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        locale: body.locale ?? 'hy',
        notificationPreference: { create: {} },
      },
    });

    return this.sessionFor(created, context);
  }

  async refresh(refreshToken: string, context: IssueContext): Promise<TokenPair> {
    const rotated = await this.tokens.rotate(refreshToken, context);
    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresIn: rotated.expiresIn,
      tokenType: 'Bearer',
    };
  }

  async logout(refreshToken: string | undefined, userId: string | null, allDevices: boolean) {
    if (allDevices && userId) {
      await this.tokens.revokeAllForUser(userId);
      return;
    }
    if (refreshToken) {
      await this.tokens.revoke(refreshToken);
    }
  }

  async forgotPassword(body: ForgotPasswordBody): Promise<VerificationChallenge> {
    return this.requestOtp({ phone: body.phone, purpose: 'RESET_PASSWORD' });
  }

  /** A password reset ends every other session: that is the point of resetting. */
  async resetPassword(body: ResetPasswordBody): Promise<{ ok: true }> {
    const proof = await this.otp.verify(body.verificationId, body.code);
    if (proof.purpose !== 'RESET_PASSWORD') {
      throw new AppError(ErrorCode.OTP_INVALID, 'That code was issued for something else');
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: proof.phone, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw AppError.notFound('Account');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS),
        phoneVerifiedAt: new Date(),
      },
    });
    await this.tokens.revokeAllForUser(user.id);

    return { ok: true };
  }

  private async sessionFor(user: User, context: IssueContext): Promise<AuthSession> {
    const issued = await this.tokens.issue({ id: user.id, role: user.role }, context);
    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresIn: issued.expiresIn,
      tokenType: 'Bearer',
      user: toUserDto(user),
    };
  }
}
