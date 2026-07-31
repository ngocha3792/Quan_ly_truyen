import { NestFactory } from '@nestjs/core';
import { MediaCleanupService } from '@/infrastructure/media';
import { WorkerModule } from '@/worker.module';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const summary = await app
      .get(MediaCleanupService)
      .cleanupExpiredUploadIntents({ batchSize: 100 });
    console.info('Media cleanup completed', summary);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    'Media cleanup failed',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
});
