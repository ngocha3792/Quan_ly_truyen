import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '@/worker.module';
import { CloudinaryWebhookInboxProcessor } from '@/infrastructure/media/cloudinary/cloudinary-webhook-inbox.processor';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
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
