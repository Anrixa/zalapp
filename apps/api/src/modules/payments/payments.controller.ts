import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { createPaymentIntentSchema } from '@zal/contracts';
import { ZodBody } from '../../common/decorators/zod.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @Post('intents')
  @ApiOperation({ summary: 'Start a deposit or balance payment' })
  createIntent(
    @CurrentUser('id') userId: string,
    @ZodBody(createPaymentIntentSchema) body: unknown,
  ) {
    return this.payments.createIntent(userId, body as never);
  }

  @ApiBearerAuth()
  @Get(':paymentId')
  @ApiOperation({ summary: 'Poll a payment after returning from the provider' })
  status(@CurrentUser('id') userId: string, @Param('paymentId') paymentId: string) {
    return this.payments.status(userId, paymentId);
  }

  /**
   * Provider callback.
   *
   * Public because the acquirer has no session — which is exactly why the
   * signature check inside is the only thing standing between this endpoint and
   * anyone marking any booking paid.
   */
  @Public()
  @Post('webhooks/:provider')
  @HttpCode(200)
  webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
    @Req() request: Request & { rawBody?: string },
  ) {
    return this.payments.handleWebhook(
      provider,
      headers,
      request.rawBody ?? JSON.stringify(body ?? {}),
      body as never,
    );
  }
}
