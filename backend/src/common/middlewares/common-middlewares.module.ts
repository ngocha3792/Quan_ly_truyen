import { DynamicModule, Module, Provider } from '@nestjs/common';

import { COMMON_MIDDLEWARE_OPTIONS } from './common-middlewares.constants';
import type { CommonMiddlewaresAsyncOptions } from './common-middlewares-async-options.interface';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';
import { JsonContentTypeMiddleware } from './json-content-type.middleware';
import { LocaleMiddleware } from './locale.middleware';
import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextModule } from './request-context.module';

@Module({})
export class CommonMiddlewaresModule {
  static register(options: CommonMiddlewaresOptions = {}): DynamicModule {
    return {
      module: CommonMiddlewaresModule,
      imports: [RequestContextModule],
      providers: [
        {
          provide: COMMON_MIDDLEWARE_OPTIONS,
          useValue: options,
        },
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
        JsonContentTypeMiddleware,
      ],
      exports: [
        COMMON_MIDDLEWARE_OPTIONS,
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
      imports: [RequestContextModule, ...(options.imports ?? [])],
      providers: [
        optionsProvider,
        ...(options.extraProviders ?? []),
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
        JsonContentTypeMiddleware,
      ],
      exports: [
        COMMON_MIDDLEWARE_OPTIONS,
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
        JsonContentTypeMiddleware,
      ],
    };
  }
}
