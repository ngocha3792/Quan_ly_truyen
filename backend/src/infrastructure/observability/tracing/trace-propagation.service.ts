import {
  context,
  propagation,
  ROOT_CONTEXT,
  trace,
  type Context,
} from '@opentelemetry/api';
import { Injectable } from '@nestjs/common';

import type {
  QueueTelemetryMetadata,
  TraceCarrier,
} from '@/common/interfaces/observability';
import {
  RequestContextStore,
  type MutableRequestContext,
} from '@/common/middlewares';

@Injectable()
export class TracePropagationService {
  constructor(private readonly requestContext: RequestContextStore) {}

  capture(input: {
    source: QueueTelemetryMetadata['source'];
    causationId?: string;
  }): QueueTelemetryMetadata {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    const request = this.requestContext.get();
    const spanContext = trace.getSpan(context.active())?.spanContext();
    const traceContext = toTraceCarrier(carrier);

    return {
      schemaVersion: 1,
      source: input.source,
      ...(request?.correlationId
        ? { correlationId: request.correlationId }
        : {}),
      ...(input.causationId
        ? { causationId: input.causationId }
        : request?.requestId
          ? { causationId: request.requestId }
          : {}),
      ...(spanContext?.traceId ? { traceId: spanContext.traceId } : {}),
      ...(traceContext ? { traceContext } : {}),
    };
  }

  runWithExtractedContext<T>(
    metadata: QueueTelemetryMetadata | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    const parent = this.extract(metadata);
    return context.with(parent, work);
  }

  runWithQueueContext<T>(
    metadata: QueueTelemetryMetadata | undefined,
    input: { requestId: string; queue: string },
    work: () => Promise<T>,
  ): Promise<T> {
    const current = this.requestContext.get();
    const queueContext: MutableRequestContext = {
      requestId: current?.requestId ?? input.requestId,
      correlationId:
        metadata?.correlationId ?? current?.correlationId ?? input.requestId,
      method: 'QUEUE',
      path: input.queue,
      startedAt: new Date(),
    };
    const parent = this.extract(metadata);
    return this.requestContext.run(queueContext, () =>
      context.with(parent, work),
    );
  }

  parse(value: unknown): QueueTelemetryMetadata | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 1) return undefined;
    const source = candidate.source;
    if (source !== 'api' && source !== 'worker' && source !== 'system') {
      return undefined;
    }
    const traceContext = parseTraceCarrier(candidate.traceContext);
    return {
      schemaVersion: 1,
      source,
      ...optionalStringField(candidate, 'correlationId'),
      ...optionalStringField(candidate, 'causationId'),
      ...optionalStringField(candidate, 'traceId'),
      ...(traceContext ? { traceContext } : {}),
    };
  }

  private extract(metadata: QueueTelemetryMetadata | undefined): Context {
    const carrier = metadata?.traceContext;
    return carrier ? propagation.extract(ROOT_CONTEXT, carrier) : ROOT_CONTEXT;
  }
}

function toTraceCarrier(
  carrier: Record<string, string>,
): TraceCarrier | undefined {
  const traceparent = carrier.traceparent;
  const tracestate = carrier.tracestate;
  return traceparent || tracestate
    ? {
        ...(traceparent ? { traceparent } : {}),
        ...(tracestate ? { tracestate } : {}),
      }
    : undefined;
}

function parseTraceCarrier(value: unknown): TraceCarrier | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const carrier = value as Record<string, unknown>;
  const traceparent = readBoundedString(carrier.traceparent, 256);
  const tracestate = readBoundedString(carrier.tracestate, 512);
  return traceparent || tracestate
    ? {
        ...(traceparent ? { traceparent } : {}),
        ...(tracestate ? { tracestate } : {}),
      }
    : undefined;
}

function optionalStringField(
  value: Record<string, unknown>,
  key: string,
): Record<string, string> {
  const parsed = readBoundedString(value[key], 256);
  return parsed ? { [key]: parsed } : {};
}

function readBoundedString(
  value: unknown,
  maxLength: number,
): string | undefined {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength
    ? value
    : undefined;
}
