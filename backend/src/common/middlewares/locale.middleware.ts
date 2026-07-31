import {
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';

import { COMMON_MIDDLEWARE_OPTIONS } from './common-middlewares.constants';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';
import {
  readHeader,
  resolveLocale,
} from './middleware-request.util';
import type {
  MiddlewareHttpRequest,
  MiddlewareHttpResponse,
  MiddlewareNext,
} from './request-context.interface';
import { RequestContextStore } from './request-context.store';

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  constructor(
    private readonly store: RequestContextStore,
    @Inject(COMMON_MIDDLEWARE_OPTIONS)
    private readonly options: CommonMiddlewaresOptions,
  ) {}

  use(
    request: MiddlewareHttpRequest,
    response: MiddlewareHttpResponse,
    next: MiddlewareNext,
  ): void {
    const locale = resolveLocale(
      readHeader(request.headers, 'accept-language'),
      this.options.locale,
    );

    request.locale = locale;

    if (request.requestContext) {
      request.requestContext.locale = locale;
    }

    if (this.store.get()) {
      this.store.patch({ locale });
    }

    response.setHeader('content-language', locale);

    next();
  }
}
