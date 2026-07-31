import {
  DynamicModule,
  Module,
} from '@nestjs/common';

import { COMMON_MIDDLEWARE_OPTIONS } from './common-middlewares.constants';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';
import { JsonContentTypeMiddleware } from './json-content-type.middleware';
import { LocaleMiddleware } from './locale.middleware';
import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextStore } from './request-context.store';

@Module({})
export class CommonMiddlewaresModule {
  static register(
    options: CommonMiddlewaresOptions = {},
  ): DynamicModule {
    return {
      module: CommonMiddlewaresModule,
      providers: [
        {
          provide: COMMON_MIDDLEWARE_OPTIONS,
          useValue: options,
        },
        RequestContextStore,
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
        JsonContentTypeMiddleware,
      ],
      exports: [
        RequestContextStore,
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
        JsonContentTypeMiddleware,
      ],
    };
  }
}
