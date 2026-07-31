import {
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { UnsupportedMediaTypeException } from '@/common/exceptions';

import {
  COMMON_MIDDLEWARE_OPTIONS,
  JSON_MUTATION_METHODS,
} from './common-middlewares.constants';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';
import {
  isJsonContentType,
  nonEmptyString,
  readHeader,
  requestHasBody,
} from './middleware-request.util';
import type {
  MiddlewareHttpRequest,
  MiddlewareHttpResponse,
  MiddlewareNext,
} from './request-context.interface';

@Injectable()
export class JsonContentTypeMiddleware
  implements NestMiddleware
{
  constructor(
    @Inject(COMMON_MIDDLEWARE_OPTIONS)
    private readonly options: CommonMiddlewaresOptions,
  ) {}

  use(
    request: MiddlewareHttpRequest,
    _response: MiddlewareHttpResponse,
    next: MiddlewareNext,
  ): void {
    const configuredMethods =
      this.options.jsonContentType?.methods ??
      JSON_MUTATION_METHODS;
    const method = (
      nonEmptyString(request.method) ?? ''
    ).toUpperCase();

    if (
      !configuredMethods.some(
        (item) => item.toUpperCase() === method,
      ) ||
      !requestHasBody(request)
    ) {
      next();
      return;
    }

    const contentType = readHeader(
      request.headers,
      'content-type',
    );

    if (
      contentType &&
      isJsonContentType(
        contentType,
        this.options.jsonContentType
          ?.allowVendorJson ?? true,
      )
    ) {
      next();
      return;
    }

    next(
      new UnsupportedMediaTypeException({
        message: 'Endpoint này chỉ chấp nhận nội dung JSON',
        received: contentType ?? undefined,
        supported: [
          'application/json',
          'application/*+json',
        ],
      }),
    );
  }
}
