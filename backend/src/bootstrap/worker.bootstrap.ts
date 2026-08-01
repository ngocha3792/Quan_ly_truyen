import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from '@/worker.module';
import { AppLoggerService } from '@/infrastructure/observability';

import { assertWorkerCanStart } from './worker-preflight';

const workerLogger = new Logger('WorkerBootstrap');

export async function bootstrapWorker(): Promise<void> {
  const context = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  context.useLogger(context.get(AppLoggerService));
  context.flushLogs();

  try {
    assertWorkerCanStart(context.get(ConfigService));
    context.enableShutdownHooks();

    workerLogger.log({ event: 'worker.started' });
  } catch (error: unknown) {
    await context.close();
    throw error;
  }
}

export async function runWorker(): Promise<void> {
  await bootstrapWorker();
}
