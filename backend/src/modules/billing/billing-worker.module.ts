import { Module } from '@nestjs/common';

import { PaymentWebhookInboxWorker } from './infrastructure';
import { BillingModule } from './billing.module';

@Module({
  imports: [BillingModule],
  providers: [PaymentWebhookInboxWorker],
})
export class BillingWorkerModule {}
