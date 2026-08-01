import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

import {
  resolveHttpRouteTemplate,
  shouldSkipHttpObservability,
} from './http-route-template.util';
import { MetricsService } from './metrics.service';

interface MetricsRequest {
  method?: unknown;
  baseUrl?: unknown;
  originalUrl?: unknown;
  url?: unknown;
  route?: { path?: unknown };
}

interface MetricsResponse {
  statusCode?: unknown;
  once(event: 'finish' | 'close', listener: () => void): unknown;
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (executionContext.getType() !== 'http' || !this.metrics.isEnabled()) {
      return next.handle();
    }
    const http = executionContext.switchToHttp();
    const request = http.getRequest<MetricsRequest>();
    if (shouldSkipHttpObservability(request)) return next.handle();

    const response = http.getResponse<MetricsResponse>();
    const method =
      typeof request.method === 'string' ? request.method : 'OTHER';
    const startedAt = performance.now();
    let finalized = false;
    this.metrics.recordHttpStart(method);

    const finish = (): void => {
      if (finalized) return;
      finalized = true;
      this.metrics.recordHttpFinish({
        method,
        route: resolveHttpRouteTemplate(request),
        statusCode:
          typeof response.statusCode === 'number' ? response.statusCode : 500,
        durationSeconds: Math.max(0, performance.now() - startedAt) / 1000,
      });
    };
    response.once('finish', finish);
    response.once('close', finish);

    return next.handle();
  }
}
