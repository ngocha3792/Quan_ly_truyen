import { context, propagation } from '@opentelemetry/api';

import { RequestContextStore } from '@/common/middlewares';

import { TracePropagationService } from './trace-propagation.service';

describe('TracePropagationService', () => {
  it('keeps correlation and causation metadata with a bounded W3C carrier', () => {
    const store = new RequestContextStore();
    const service = new TracePropagationService(store);
    jest.spyOn(propagation, 'inject').mockImplementation((_ctx, carrier) => {
      Object.assign(carrier as object, {
        traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
        baggage: 'secret=must-not-propagate',
      });
    });
    const metadata = store.run(
      {
        requestId: 'request-1',
        correlationId: 'correlation-1',
        method: 'POST',
        path: '/test',
        startedAt: new Date(),
      },
      () => service.capture({ source: 'api', causationId: 'event-1' }),
    );
    expect(metadata.correlationId).toBe('correlation-1');
    expect(metadata.causationId).toBe('event-1');
    expect(metadata.traceContext?.traceparent).toMatch(/^00-/);
    expect(JSON.stringify(metadata)).not.toContain('baggage');
    expect(JSON.stringify(metadata)).not.toContain('secret');
  });

  it('extracts context and installs the existing request context for workers', async () => {
    const store = new RequestContextStore();
    const service = new TracePropagationService(store);
    const extracted = context.active();
    const extract = jest
      .spyOn(propagation, 'extract')
      .mockReturnValue(extracted);
    await service.runWithQueueContext(
      {
        schemaVersion: 1,
        source: 'api',
        correlationId: 'correlation-1',
        causationId: 'outbox-1',
        traceContext: {
          traceparent:
            '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
        },
      },
      { requestId: 'job-1', queue: 'mail' },
      () => {
        expect(store.get()).toEqual(
          expect.objectContaining({
            requestId: 'job-1',
            correlationId: 'correlation-1',
          }),
        );
        return Promise.resolve();
      },
    );
    expect(extract).toHaveBeenCalled();
  });
});
