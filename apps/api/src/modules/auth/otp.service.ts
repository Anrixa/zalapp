import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { VerificationPurpose } from '@prisma/client';
import { ErrorCode, maskPhone, type VerificationChallenge } from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { loadEnv } from '../../config/env';
import { SmsService } from './sms.service';

/**
 * One-time SMS codes.
 *
 * The code is stored hashed and never returned. What travels back to the client
 * is a `verificationId`; the phone number is sent once, on request, and never
 * again — so an intercepted verify call reveals neither the number nor the code.
 *
 * Attempts are counted on the row, not per request, so retrying with a fresh
 * connection does not reset the budget.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async issue(params: {
    phone: string;
    purpose: VerificationPurpose;
    userId?: string | null;
  }): Promise<VerificationChallenge> {
    const { phone, purpose, userId } = params;

    // Supersede any code still outstanding for this number and purpose, so a
    // guest who taps "resend" twice cannot end up with two valid codes.
    await this.prisma.verificationCode.updateMany({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + this.env.OTP_TTL_SECONDS * 1000);

    const record = await this.prisma.verificationCode.create({
      data: {
        phone,
        purpose,
        userId: userId ?? null,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt,
      },
    });

    await this.sms.sendVerificationCode(phone, code);

    return {
      verificationId: record.id,
      phoneHint: maskPhone(phone),
      expiresIn: this.env.OTP_TTL_SECONDS,
      resendAfter: this.env.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async resend(verificationId: string): Promise<VerificationChallenge> {
    const record = await this.prisma.verificationCode.findUnique({ where: { id: verificationId } });
    if (!record || record.consumedAt) {
      throw new AppError(ErrorCode.OTP_INVALID, 'Start again — this request has expired');
    }

    const elapsed = (Date.now() - record.lastSentAt.getTime()) / 1000;
    const cooldown = this.env.OTP_RESEND_COOLDOWN_SECONDS;
    if (elapsed < cooldown) {
      const retryAfter = Math.ceil(cooldown - elapsed);
      throw new AppError(ErrorCode.OTP_RESEND_TOO_SOON, `Try again in ${retryAfter} seconds`, {
        retryAfter,
      });
    }

    // A resend issues a fresh code rather than re-sending the old one: if the
    // first SMS arrives late, the guest is not left staring at a code that has
    // just been invalidated.
    return this.issue({
      phone: record.phone,
      purpose: record.purpose,
      userId: record.userId,
    });
  }

  /**
   * Check a code and consume it.
   *
   * Returns the row so the caller knows which phone and purpose were proved,
   * rather than trusting anything else the request said.
   */
  async verify(
    verificationId: string,
    code: string,
  ): Promise<{ phone: string; purpose: VerificationPurpose; userId: string | null }> {
    const record = await this.prisma.verificationCode.findUnique({ where: { id: verificationId } });

    if (!record || record.consumedAt) {
      throw new AppError(ErrorCode.OTP_INVALID, 'That code is not valid');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.OTP_EXPIRED, 'That code has expired — ask for a new one');
    }

    if (record.attempts >= this.env.OTP_MAX_ATTEMPTS) {
      throw new AppError(
        ErrorCode.OTP_TOO_MANY_ATTEMPTS,
        'Too many attempts. Ask for a new code.',
        { retryAfter: this.env.OTP_RESEND_COOLDOWN_SECONDS },
      );
    }

    const matches = await bcrypt.compare(code, record.codeHash);
    if (!matches) {
      const updated = await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const remaining = Math.max(0, this.env.OTP_MAX_ATTEMPTS - updated.attempts);
      throw new AppError(
        ErrorCode.OTP_INVALID,
        remaining > 0
          ? `That code is not right — ${remaining} ${remaining === 1 ? 'try' : 'tries'} left`
          : 'That code is not right. Ask for a new one.',
      );
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return { phone: record.phone, purpose: record.purpose, userId: record.userId };
  }
}
