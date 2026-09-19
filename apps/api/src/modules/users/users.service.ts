import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  ErrorCode,
  type AddPaymentMethodBody,
  type ChangePasswordBody,
  type ChangePhoneBody,
  type DeleteAccountBody,
  type Me,
  type NotificationPreferences,
  type RegisterDeviceBody,
  type SavedPaymentMethod,
  type UpdateNotificationPreferencesBody,
  type UpdateProfileBody,
  type UserStats,
  type VerificationChallenge,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { OtpService } from '../auth/otp.service';
import { TokenService } from '../auth/token.service';
import { StorageService } from '../uploads/storage.service';
import { toUserDto } from './user.mapper';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly storage: StorageService,
  ) {}

  async me(userId: string): Promise<Me> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw AppError.notFound('Account');

    const [stats, unread] = await Promise.all([
      this.stats(userId),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { ...toUserDto(user), stats, unreadNotifications: unread };
  }

  async stats(userId: string): Promise<UserStats> {
    // Three counts in one round trip rather than three sequential awaits: the
    // Profile screen shows them together and should not pay for them in series.
    const [bookings, saved, reviews] = await this.prisma.$transaction([
      this.prisma.booking.count({
        where: { userId, status: { notIn: ['DRAFT', 'EXPIRED'] } },
      }),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.review.count({ where: { userId, deletedAt: null } }),
    ]);

    return { bookings, saved, reviews };
  }

  async updateProfile(userId: string, body: UpdateProfileBody): Promise<Me> {
    /**
     * An avatar has to be one of ours. The field is a URL because that is what
     * every client renders, but accepting any URL would let a profile point at
     * an attacker's server and quietly report the IP of everyone who loads a
     * page the avatar appears on — a venue listing, a review, a message thread.
     */
    if (body.avatarUrl && !this.storage.isOwnMediaUrl(body.avatarUrl)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'Upload the picture first and use the URL that came back',
      );
    }

    if (body.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: body.email, id: { not: userId }, deletedAt: null },
        select: { id: true },
      });
      if (taken) {
        throw new AppError(
          ErrorCode.EMAIL_ALREADY_REGISTERED,
          'That email is already used by another account',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
      },
    });

    return this.me(userId);
  }

  /**
   * Change the password, then sign every session out.
   *
   * Someone changing a password usually suspects the old one is known. Leaving
   * other sessions alive would defeat the act.
   */
  async changePassword(userId: string, body: ChangePasswordBody): Promise<{ ok: true }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'This account signs in with Google — set a password from the reset flow',
      );
    }

    const matches = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!matches) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'That current password is not right');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS) },
    });
    await this.tokens.revokeAllForUser(userId);

    return { ok: true };
  }

  /** A new number is proved before it replaces the old one. */
  async requestPhoneChange(userId: string, body: ChangePhoneBody): Promise<VerificationChallenge> {
    const taken = await this.prisma.user.findFirst({
      where: { phone: body.phone, id: { not: userId }, deletedAt: null },
      select: { id: true },
    });
    if (taken) {
      throw new AppError(
        ErrorCode.PHONE_ALREADY_REGISTERED,
        'That number already belongs to another account',
      );
    }

    return this.otp.issue({ phone: body.phone, purpose: 'VERIFY_PHONE', userId });
  }

  async confirmPhoneChange(userId: string, verificationId: string, code: string): Promise<Me> {
    const proof = await this.otp.verify(verificationId, code);
    if (proof.userId !== userId) {
      throw AppError.forbidden('That code was issued for a different account');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: proof.phone, phoneVerifiedAt: new Date() },
    });

    return this.me(userId);
  }

  async notificationPreferences(userId: string): Promise<NotificationPreferences> {
    const existing = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      push: existing.push,
      sms: existing.sms,
      email: existing.email,
      priceDrops: existing.priceDrops,
    };
  }

  async updateNotificationPreferences(
    userId: string,
    body: UpdateNotificationPreferencesBody,
  ): Promise<NotificationPreferences> {
    const updated = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    });
    return {
      push: updated.push,
      sms: updated.sms,
      email: updated.email,
      priceDrops: updated.priceDrops,
    };
  }

  /**
   * Register a push token.
   *
   * Tokens migrate between accounts when a phone is handed on or a second
   * person signs in, so the same token is moved rather than duplicated.
   */
  async registerDevice(userId: string, body: RegisterDeviceBody): Promise<{ ok: true }> {
    await this.prisma.device.upsert({
      where: { pushToken: body.pushToken },
      create: {
        userId,
        pushToken: body.pushToken,
        platform: body.platform,
        deviceName: body.deviceName ?? null,
        appVersion: body.appVersion ?? null,
      },
      update: {
        userId,
        platform: body.platform,
        deviceName: body.deviceName ?? null,
        appVersion: body.appVersion ?? null,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true };
  }

  async removeDevice(userId: string, deviceId: string): Promise<{ ok: true }> {
    await this.prisma.device.deleteMany({ where: { id: deviceId, userId } });
    return { ok: true };
  }

  async paymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
    const rows = await this.prisma.paymentMethod.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      brand: row.brand,
      last4: row.last4,
      expiryMonth: row.expiryMonth,
      expiryYear: row.expiryYear,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Store a provider token, never a card.
   *
   * The brand and last four digits come back from the provider alongside the
   * token; nothing here ever sees a PAN, which is what keeps this endpoint out
   * of PCI scope.
   */
  async addPaymentMethod(
    userId: string,
    body: AddPaymentMethodBody,
    descriptor: { brand: string; last4: string | null; expiryMonth?: number; expiryYear?: number },
  ): Promise<SavedPaymentMethod> {
    const created = await this.prisma.$transaction(async (tx) => {
      if (body.makeDefault) {
        await tx.paymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const count = await tx.paymentMethod.count({ where: { userId, deletedAt: null } });

      return tx.paymentMethod.create({
        data: {
          userId,
          provider: body.provider,
          brand: descriptor.brand,
          last4: descriptor.last4,
          expiryMonth: descriptor.expiryMonth ?? null,
          expiryYear: descriptor.expiryYear ?? null,
          providerToken: body.providerToken,
          // The first card on file is the default whether or not anyone asked.
          isDefault: body.makeDefault || count === 0,
        },
      });
    });

    return {
      id: created.id,
      provider: created.provider,
      brand: created.brand,
      last4: created.last4,
      expiryMonth: created.expiryMonth,
      expiryYear: created.expiryYear,
      isDefault: created.isDefault,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async removePaymentMethod(userId: string, methodId: string): Promise<{ ok: true }> {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: methodId, userId, deletedAt: null },
    });
    if (!method) throw AppError.notFound('Payment method');

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentMethod.update({
        where: { id: methodId },
        data: { deletedAt: new Date(), isDefault: false },
      });

      if (method.isDefault) {
        const next = await tx.paymentMethod.findFirst({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });

    return { ok: true };
  }

  /**
   * Request account deletion.
   *
   * Flagged, not erased: a guest with a hall booked next month has a contract
   * with a host, and payments have to stay reconcilable. The flag starts the
   * retention clock and signs every session out.
   */
  async requestDeletion(userId: string, _body: DeleteAccountBody): Promise<{ ok: true }> {
    const upcoming = await this.prisma.booking.count({
      where: {
        userId,
        status: { in: ['AWAITING_DEPOSIT', 'PENDING_HOST', 'CONFIRMED'] },
        eventDate: { gte: new Date() },
      },
    });

    if (upcoming > 0) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'You still have upcoming bookings. Cancel them first, or contact support.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date() },
    });
    await this.tokens.revokeAllForUser(userId);

    return { ok: true };
  }
}
