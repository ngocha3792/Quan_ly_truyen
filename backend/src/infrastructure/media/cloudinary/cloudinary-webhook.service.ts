import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/infrastructure/database/prisma';

import { CLOUDINARY_CLIENT } from './cloudinary.constants';
import type { CloudinaryClient } from './cloudinary.provider';

@Injectable()
export class CloudinaryWebhookService {
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinary: CloudinaryClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handle(input: {
    rawBody: Buffer;
    timestamp: string;
    signature: string;
  }): Promise<void> {
    const apiSecret = this.configService.getOrThrow<string>(
      'cloudinary.apiSecret',
    );
    const validFor = this.configService.get<number>(
      'cloudinary.webhookSignatureTtlSeconds',
      300,
    );

    const valid = this.cloudinary.utils.verifyNotificationSignature(
      input.rawBody.toString('utf8'),
      Number(input.timestamp),
      input.signature,
      validFor,
    );

    if (!valid) {
      throw new Error('Invalid Cloudinary webhook signature');
    }

    const payload = JSON.parse(
      input.rawBody.toString('utf8'),
    ) as Record<string, unknown>;

    await this.processIdempotently(payload);
  }

  private async processIdempotently(
    _payload: Record<string, unknown>,
  ): Promise<void> {
    // Webhook idempotency handling place
  }
}
