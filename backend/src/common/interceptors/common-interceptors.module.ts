import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import {
  COMMON_HTTP_TIMEOUT_MS,
  DEFAULT_HTTP_TIMEOUT_MS,
} from '@/common/constants';
import { LoggingInterceptor } from './logging.interceptor';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { TimeoutInterceptor } from './timeout.interceptor';

@Module({
  providers: [
    {
      provide: COMMON_HTTP_TIMEOUT_MS,
      useValue: DEFAULT_HTTP_TIMEOUT_MS,
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
