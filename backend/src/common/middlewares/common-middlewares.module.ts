import { DynamicModule, Module, Provider } from '@nestjs/common';

import { COMMON_MIDDLEWARE_OPTIONS } from './common-middlewares.constants';
import type { CommonMiddlewaresAsyncOptions } from './common-middlewares-async-options.interface';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';
import { JsonContentTypeMiddleware } from './json-content-type.middleware';
import { LocaleMiddleware } from './locale.middleware';
import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextStore } from './request-context.store';

@Module({})
export class CommonMiddlewaresModule {
  static register(options: CommonMiddlewaresOptions = {}): DynamicModule {
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

  static registerAsync(options: CommonMiddlewaresAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: COMMON_MIDDLEWARE_OPTIONS,
      inject: (options.inject as any[]) ?? [],
      useFactory: options.useFactory ?? (() => ({})),
    };

    return {
      module: CommonMiddlewaresModule,
      imports: options.imports ?? [],
      providers: [
        optionsProvider,
        ...(options.extraProviders ?? []),
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
