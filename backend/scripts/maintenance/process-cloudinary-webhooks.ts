import { NestFactory } from '@nestjs/core';
import { CloudinaryWebhookInboxProcessor } from '@/infrastructure/media/cloudinary/cloudinary-webhook-inbox.processor';
import { CloudinaryWebhookCommandModule } from '@/maintenance/cloudinary-webhook-command.module';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    CloudinaryWebhookCommandModule,
    { logger: ['error', 'warn', 'log'] },
  );
  try {
    const summary = await app
      .get(CloudinaryWebhookInboxProcessor)
      .processBatch(100);
    console.info('Cloudinary webhook processing completed', summary);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    'Cloudinary webhook processing failed',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
});
