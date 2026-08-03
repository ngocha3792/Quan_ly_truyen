import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { runProductionBootstrapGate } from './production-gate.bootstrap';
import { WorkerModule } from '@/worker.module';
import { AppLoggerService } from '@/infrastructure/observability';

import { assertWorkerCanStart } from './worker-preflight';

const workerLogger = new Logger('WorkerBootstrap');

export async function bootstrapWorker(): Promise<void> {
  /*
   * Phải chạy trước WorkerModule.
   *
   * Nếu tạo WorkerModule trước, BullMQ processor
   * có thể bắt đầu nhận job trước khi gate pass.
   */
  await runProductionBootstrapGate('worker');

  const context = await NestFactory.createApplicationContext(
    WorkerModule,

    {
      bufferLogs: true,
    },
  );

  context.useLogger(context.get(AppLoggerService));

  context.flushLogs();

  try {
    assertWorkerCanStart(context.get(ConfigService));

    context.enableShutdownHooks();

    workerLogger.log({
      event: 'worker.started',
    });
  } catch (error: unknown) {
    await context.close();

    throw error;
  }
}
export async function runWorker(): Promise<void> {
  await bootstrapWorker();
}
