import {
  type Attributes,
  type Span,
  type Tracer,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ObservabilityConfig } from '@/config';

@Injectable()
export class TracingService {
  private readonly tracer: Tracer;

  constructor(configService: ConfigService) {
    const config =
      configService.getOrThrow<ObservabilityConfig>('observability');
    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  }

  inSpan<T>(
    name: string,
    attributes: Attributes,
    work: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await work(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: unknown) {
        if (error instanceof Error) span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
