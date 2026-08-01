import {
  type INestApplication,
  type RawBodyRequest,
  RequestMethod,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded, type Request } from 'express';

import { API_PREFIX, CONTENT_TYPES } from '@/common/constants';
import { AppValidationPipe } from '@/common/pipes';
import type { AppConfig } from '@/config';

export function configureApplication(
  app: INestApplication,
  config: AppConfig,
): void {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: 'internal/metrics', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(new AppValidationPipe());

  const expressApp = app as NestExpressApplication;

  expressApp.use(
    json({
      limit: config.jsonBodyLimit,
      type: CONTENT_TYPES.JSON,
      verify: (request, _response, buffer) => {
        (request as RawBodyRequest<Request>).rawBody = Buffer.from(buffer);
      },
    }),
  );

  expressApp.use(
    urlencoded({
      extended: true,
      limit: config.urlEncodedBodyLimit,
    }),
  );

  if (config.trustProxy) {
    expressApp.set('trust proxy', true);
  }
}
