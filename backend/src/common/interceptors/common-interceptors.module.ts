import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { COMMON_HTTP_TIMEOUT_MS } from '@/common/constants';
import type { AppConfig } from '@/config';
import { LoggingInterceptor } from './logging.interceptor';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { TimeoutInterceptor } from './timeout.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: COMMON_HTTP_TIMEOUT_MS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        configService.getOrThrow<AppConfig>('app').requestTimeoutMs,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
  ],
  exports: [COMMON_HTTP_TIMEOUT_MS],
})
export class CommonInterceptorsModule {}
