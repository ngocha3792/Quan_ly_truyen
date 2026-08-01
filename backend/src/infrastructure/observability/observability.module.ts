import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RequestContextModule } from '@/common/middlewares';

import { AppLoggerService } from './logger';
import {
  HttpMetricsInterceptor,
  MetricsController,
  MetricsGuard,
  MetricsService,
} from './metrics';
import {
  TelemetryLifecycleService,
  TracePropagationService,
  TracingService,
} from './tracing';

@Global()
@Module({
  imports: [RequestContextModule],
  controllers: [MetricsController],
  providers: [
    AppLoggerService,
    MetricsService,
    MetricsGuard,
    TracingService,
    TracePropagationService,
    TelemetryLifecycleService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [
    AppLoggerService,
    MetricsService,
    TracingService,
    TracePropagationService,
  ],
})
export class ObservabilityModule {}
