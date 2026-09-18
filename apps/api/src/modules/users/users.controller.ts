import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  addPaymentMethodSchema,
  changePasswordSchema,
  changePhoneSchema,
  deleteAccountSchema,
  otpVerifySchema,
  registerDeviceSchema,
  updateNotificationPreferencesSchema,
  updateProfileSchema,
} from '@zal/contracts';
import { ZodBody } from '../../common/decorators/zod.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in guest, with the Profile screen counters' })
  me(@CurrentUser('id') userId: string) {
    return this.users.me(userId);
  }

  @Patch()
  updateProfile(@CurrentUser('id') userId: string, @ZodBody(updateProfileSchema) body: unknown) {
    return this.users.updateProfile(userId, body as never);
  }

  @Get('stats')
  stats(@CurrentUser('id') userId: string) {
    return this.users.stats(userId);
  }

  @Put('password')
  @HttpCode(200)
  changePassword(@CurrentUser('id') userId: string, @ZodBody(changePasswordSchema) body: unknown) {
    return this.users.changePassword(userId, body as never);
  }

  @Post('phone')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a code to a new phone number' })
  requestPhoneChange(@CurrentUser('id') userId: string, @ZodBody(changePhoneSchema) body: unknown) {
    return this.users.requestPhoneChange(userId, body as never);
  }

  @Put('phone')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm the code and move the account to the new number' })
  confirmPhoneChange(
    @CurrentUser('id') userId: string,
    @ZodBody(otpVerifySchema) body: { verificationId: string; code: string },
  ) {
    return this.users.confirmPhoneChange(userId, body.verificationId, body.code);
  }

  @Get('notification-preferences')
  notificationPreferences(@CurrentUser('id') userId: string) {
    return this.users.notificationPreferences(userId);
  }

  @Patch('notification-preferences')
  updateNotificationPreferences(
    @CurrentUser('id') userId: string,
    @ZodBody(updateNotificationPreferencesSchema) body: unknown,
  ) {
    return this.users.updateNotificationPreferences(userId, body as never);
  }

  @Post('devices')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register this device for push notifications' })
  registerDevice(@CurrentUser('id') userId: string, @ZodBody(registerDeviceSchema) body: unknown) {
    return this.users.registerDevice(userId, body as never);
  }

  @Delete('devices/:deviceId')
  removeDevice(@CurrentUser('id') userId: string, @Param('deviceId') deviceId: string) {
    return this.users.removeDevice(userId, deviceId);
  }

  @Get('payment-methods')
  paymentMethods(@CurrentUser('id') userId: string) {
    return this.users.paymentMethods(userId);
  }

  /**
   * The descriptor (brand, last four) is supplied by the client because it comes
   * straight from the provider's tokenisation response. It is display metadata
   * only — nothing here is trusted for authorisation, and no card number is
   * accepted by this endpoint at all.
   */
  @Post('payment-methods')
  addPaymentMethod(
    @CurrentUser('id') userId: string,
    @ZodBody(
      addPaymentMethodSchema.extend({
        brand: z.string().min(1).max(32),
        last4: z.string().length(4).nullable().default(null),
        expiryMonth: z.number().int().min(1).max(12).optional(),
        expiryYear: z.number().int().min(2024).max(2100).optional(),
      }),
    )
    body: {
      provider: never;
      providerToken: string;
      makeDefault: boolean;
      brand: string;
      last4: string | null;
      expiryMonth?: number;
      expiryYear?: number;
    },
  ) {
    const { brand, last4, expiryMonth, expiryYear, ...method } = body;
    return this.users.addPaymentMethod(userId, method as never, {
      brand,
      last4,
      ...(expiryMonth !== undefined ? { expiryMonth } : {}),
      ...(expiryYear !== undefined ? { expiryYear } : {}),
    });
  }

  @Delete('payment-methods/:methodId')
  removePaymentMethod(@CurrentUser('id') userId: string, @Param('methodId') methodId: string) {
    return this.users.removePaymentMethod(userId, methodId);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Request account deletion' })
  deleteAccount(@CurrentUser('id') userId: string, @ZodBody(deleteAccountSchema) body: unknown) {
    return this.users.requestDeletion(userId, body as never);
  }
}
