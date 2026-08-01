import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from '@/worker.module';

import { assertWorkerCanStart } from './worker-preflight';

const workerLogger = new Logger('WorkerBootstrap');

export async function bootstrapWorker(): Promise<void> {
  const context = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  try {
    assertWorkerCanStart(context.get(ConfigService));
    context.enableShutdownHooks();

    workerLogger.log('Worker process started successfully');
  } catch (error: unknown) {
    await context.close();
    throw error;
  }
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
