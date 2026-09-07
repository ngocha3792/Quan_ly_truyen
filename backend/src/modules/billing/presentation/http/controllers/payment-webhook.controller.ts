import {
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '@/common/decorators';
import { InvalidInputException } from '@/common/exceptions';

import {
  ProcessPaymentWebhookCommand,
  ProcessPaymentWebhookCommandHandler,
} from '../../../application';

@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(
    private readonly processWebhook: ProcessPaymentWebhookCommandHandler,
  ) {}

  @Post(':providerCode')
  @Public()
  @HttpCode(200)
  handle(
    @Req() request: RawBodyRequest<Request>,
    @Param('providerCode') providerCode: string,
    @Headers('x-payment-timestamp') timestamp: string | undefined,
    @Headers('x-payment-signature') signature: string | undefined,
  ) {
    if (!request.rawBody || !timestamp || !signature) {
      throw new InvalidInputException({
        message: 'Thiếu raw body hoặc chữ ký webhook thanh toán',
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
