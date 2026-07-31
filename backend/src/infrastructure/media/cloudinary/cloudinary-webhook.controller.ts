import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '@/common/decorators/auth';
import { InvalidInputException } from '@/common/exceptions';

import { CloudinaryWebhookService } from './cloudinary-webhook.service';

@Controller('webhooks/cloudinary')
export class CloudinaryWebhookController {
  constructor(private readonly webhookService: CloudinaryWebhookService) {}

  @Post()
  @Public()
  @HttpCode(200)
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-cld-timestamp') timestamp: string | undefined,
    @Headers('x-cld-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!request.rawBody || !timestamp || !signature) {
      throw new InvalidInputException({
        message: 'Thiếu raw body hoặc header chữ ký Cloudinary webhook',
      });
    }

    await this.webhookService.handle({
      rawBody: request.rawBody,
      timestamp,
      signature,
    });

    return { received: true };
  }
}
