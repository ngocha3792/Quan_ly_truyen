import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { shutdownTelemetry } from '../instrumentation';

import { AppLoggerService } from '../logger';

@Injectable()
export class TelemetryLifecycleService implements OnApplicationShutdown {
  constructor(private readonly logger: AppLoggerService) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.flush();
    await shutdownTelemetry();
  }
}
