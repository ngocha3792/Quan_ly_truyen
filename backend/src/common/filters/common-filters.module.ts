import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AllExceptionsFilter } from './all-exceptions.filter';
import { ExceptionNormalizer } from './exception-normalizer';

@Module({
  providers: [
    ExceptionNormalizer,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [ExceptionNormalizer],
})
export class CommonFiltersModule {}
