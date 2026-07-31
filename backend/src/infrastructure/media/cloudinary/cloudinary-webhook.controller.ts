import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { CloudinaryWebhookService } from './cloudinary-webhook.service';

@Controller('webhooks/cloudinary')
export class CloudinaryWebhookController {
  constructor(
    private readonly webhookService: CloudinaryWebhookService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-cld-timestamp') timestamp: string | undefined,
    @Headers('x-cld-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!request.rawBody || !timestamp || !signature) {
      throw new Error('Missing Cloudinary webhook signature data');
    }

    await this.webhookService.handle({
      rawBody: request.rawBody,
      timestamp,
      signature,
    });

    return { received: true };
  }
}
