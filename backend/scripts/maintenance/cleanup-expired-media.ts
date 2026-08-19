import { NestFactory } from '@nestjs/core';

import {
  CleanupStaleMediaCommand,
  CleanupStaleMediaCommandHandler,
} from '@/modules/media';

import { MediaCleanupCommandModule } from '@/maintenance/media-cleanup-command.module';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    MediaCleanupCommandModule,

    {
      logger: ['error', 'warn', 'log'],
    },
  );

  try {
    const summary = await app
      .get(CleanupStaleMediaCommandHandler)
      .execute(new CleanupStaleMediaCommand({ batchSize: 100 }));

    console.info(
      'Media cleanup completed',

      summary,
    );
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
