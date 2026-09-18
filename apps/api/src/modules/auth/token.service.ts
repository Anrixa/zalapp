import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ErrorCode, type TokenPair } from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { loadEnv } from '../../config/env';

export interface IssueContext {
  userAgent?: string;
  ip?: string;
  /** Continue an existing device's session family instead of starting a new one. */
  familyId?: string;
}

/**
 * Access and refresh tokens.
 *
 * The access token is a short-lived JWT the API can verify without touching the
 * database. The refresh token is a random 256-bit string stored only as a
 * SHA-256 hash, so a database dump is not a set of live sessions.
 *
 * Rotation with reuse detection: every refresh spends the presented token and
 * issues a new one in the same family. If a token that has already been spent
 * comes back, either it leaked or a client is buggy — either way the whole
 * family is revoked, which logs that device out rather than letting a thief and
 * the real user take turns refreshing the same chain.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issue(
    user: { id: string; role: string },
    context: IssueContext = {},
  ): Promise<TokenPair & { familyId: string }> {
    const familyId = context.familyId ?? randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, sid: familyId },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.JWT_ACCESS_TTL },
    );

    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.env.JWT_REFRESH_TTL * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt,
        userAgent: context.userAgent?.slice(0, 300),
        ip: context.ip?.slice(0, 64),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL,
      tokenType: 'Bearer',
      familyId,
    };
  }

  /** Spend a refresh token and issue its successor. */
  async rotate(
    presentedToken: string,
    context: IssueContext = {},
  ): Promise<TokenPair & { userId: string; role: string; familyId: string }> {
    const tokenHash = hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.revokedAt) {
      throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID, 'Sign in again to continue');
    }

    if (existing.usedAt) {
      // Replay. Whoever holds this chain should not keep it.
      await this.revokeFamily(existing.familyId);
      this.logger.warn(`Refresh token reuse detected for user ${existing.userId}; family revoked`);
      throw new AppError(
        ErrorCode.REFRESH_TOKEN_REUSED,
        'That session was signed out for security. Sign in again.',
      );
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID, 'Your session expired — sign in again');
    }

    if (existing.user.deletedAt) {
      throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID, 'This account is no longer active');
    }

    const issued = await this.issue(
      { id: existing.userId, role: existing.user.role },
      { ...context, familyId: existing.familyId },
    );

    const successor = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(issued.refreshToken!) },
      select: { id: true },
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { usedAt: new Date(), replacedById: successor?.id ?? null },
    });

    return {
      ...issued,
      userId: existing.userId,
      role: existing.user.role,
    };
  }

  /** Sign out one device. */
  async revoke(presentedToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Sign out everywhere — what "Log out of all devices" and a password change do. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Housekeeping: drop rows that can no longer authenticate anything. */
  async pruneExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
