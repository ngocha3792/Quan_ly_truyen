import { Writable } from 'node:stream';

import { context, ROOT_CONTEXT, trace, TraceFlags } from '@opentelemetry/api';
import { ConfigService } from '@nestjs/config';
import type { ModuleRef } from '@nestjs/core';

import { AppLoggerService } from './app-logger.service';

describe('AppLoggerService', () => {
  const records: Array<Record<string, unknown>> = [];
  let logger: AppLoggerService;
  let requestContext:
    { requestId: string; correlationId: string; userId?: string } | undefined;

  beforeEach(() => {
    records.length = 0;
    requestContext = {
      requestId: 'request-1',
      correlationId: 'correlation-1',
    };
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        records.push(JSON.parse(String(chunk)) as Record<string, unknown>);
        callback();
      },
    });
    const moduleRef = {
      get: jest.fn().mockReturnValue({ get: () => requestContext }),
    } as unknown as ModuleRef;
    logger = new AppLoggerService(
      new ConfigService({
        observability: {
          serviceName: 'test-api',
          serviceVersion: '1.2.3',
          serviceInstanceId: 'instance-1',
          log: { level: 'trace', pretty: false, includeSource: false },
        },
      }),
      moduleRef,
      destination,
    );
  });

  it('writes a structured string log with service and request context', () => {
    logger.log('completed', 'ExampleContext');

    expect(records[0]).toEqual(
      expect.objectContaining({
        msg: 'completed',
        context: 'ExampleContext',
        'service.name': 'test-api',
        'service.version': '1.2.3',
        'service.instance.id': 'instance-1',
        requestId: 'request-1',
        correlationId: 'correlation-1',
      }),
    );
  });

  it('serializes object messages and Error objects safely', () => {
    logger.error(
      { event: 'operation.failed', password: 'do-not-log' },
      new TypeError('failed'),
      'ExampleContext',
    );

    expect(records[0]).toEqual(
      expect.objectContaining({
        event: 'operation.failed',
        password: '[REDACTED]',
      }),
    );
    expect(records[0].err).toEqual({
      type: 'TypeError',
      message: 'failed',
      stack: expect.stringContaining('TypeError: failed') as unknown,
    });
  });

  it('enriches an active trace without requiring a second request context', () => {
    const spanContext = {
      traceId: '11111111111111111111111111111111',
      spanId: '2222222222222222',
      traceFlags: TraceFlags.SAMPLED,
    };
    const span = trace.wrapSpanContext(spanContext);
    const getSpan = jest.spyOn(trace, 'getSpan').mockReturnValue(span);

    context.with(trace.setSpan(ROOT_CONTEXT, span), () => logger.log('traced'));

    expect(records[0]).toEqual(
      expect.objectContaining({
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      }),
    );
    getSpan.mockRestore();
  });

  it('works without request or active trace context', () => {
    requestContext = undefined;

    expect(() => logger.warn('background')).not.toThrow();
    expect(records[0]).not.toHaveProperty('requestId');
    expect(records[0]).not.toHaveProperty('traceId');
  });
});
