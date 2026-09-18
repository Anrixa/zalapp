import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProviderService } from './payment-provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
