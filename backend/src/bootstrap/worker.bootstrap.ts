import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from '@/worker.module';

const workerLogger = new Logger('WorkerBootstrap');

export async function bootstrapWorker(): Promise<void> {
  const context = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  context.enableShutdownHooks();

  workerLogger.log('Worker process started successfully');
}

export async function runWorker(): Promise<void> {
  try {
    await bootstrapWorker();
  } catch (error: unknown) {
    workerLogger.error(
      'Worker bootstrap failed',
      error instanceof Error ? error.stack : String(error),
    );

    process.exitCode = 1;
  }
}
