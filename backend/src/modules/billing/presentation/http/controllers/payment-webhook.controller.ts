import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { ClientIp, Public } from '@/common/decorators';
import { InvalidInputException } from '@/common/exceptions';
import {
  MONETIZATION_RATE_LIMITER_PORT,
  type MonetizationRateLimiterPort,
} from '@/modules/monetization';

import {
  ProcessPaymentWebhookCommand,
  ProcessPaymentWebhookCommandHandler,
} from '../../../application';

@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(
    private readonly processWebhook: ProcessPaymentWebhookCommandHandler,
    @Inject(MONETIZATION_RATE_LIMITER_PORT)
    private readonly rateLimiter: MonetizationRateLimiterPort,
  ) {}

  @Post(':providerCode')
  @Public()
  @HttpCode(200)
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Param('providerCode') providerCode: string,
    @Headers('x-payment-timestamp') timestamp: string | undefined,
    @Headers('x-payment-signature') signature: string | undefined,
    @ClientIp() ipAddress: string | undefined,
  ) {
    if (!request.rawBody || !timestamp || !signature) {
      throw new InvalidInputException({
        message: 'Thiếu raw body hoặc chữ ký webhook thanh toán',
      });
    }
    await this.rateLimiter.consume({
      operation: 'payment_webhook',
      subject: `provider:${providerCode}`,
    });
    if (ipAddress) {
      await this.rateLimiter.consume({
        operation: 'payment_webhook',
        subject: `ip:${ipAddress}`,
      });
    }
    return this.processWebhook.execute(
      new ProcessPaymentWebhookCommand(
        providerCode,
        request.rawBody,
        timestamp,
        signature,
      ),
    );
  }
}
