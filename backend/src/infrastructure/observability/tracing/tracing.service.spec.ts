import { ConfigService } from '@nestjs/config';
import {
  type Span,
  SpanStatusCode,
  trace,
  type Tracer,
} from '@opentelemetry/api';

import { TracingService } from './tracing.service';

describe('TracingService', () => {
  const span = {
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(trace, 'getTracer').mockReturnValue({
      startActiveSpan: (
        _name: string,
        _options: unknown,
        work: (activeSpan: Span) => Promise<unknown>,
      ) => work(span as unknown as Span),
    } as unknown as Tracer);
  });

  it('ends a successful span', async () => {
    const service = createService();
    await expect(
      service.inSpan('test', {}, () => Promise.resolve(42)),
    ).resolves.toBe(42);
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('records and rethrows an error before ending the span', async () => {
    const service = createService();
    const failure = new Error('failure');
    await expect(
      service.inSpan('test', {}, async () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(span.recordException).toHaveBeenCalledWith(failure);
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    expect(span.end).toHaveBeenCalledTimes(1);
  });
});

function createService(): TracingService {
  return new TracingService(
    new ConfigService({
      observability: { serviceName: 'test', serviceVersion: '1.0.0' },
    }),
  );
}
