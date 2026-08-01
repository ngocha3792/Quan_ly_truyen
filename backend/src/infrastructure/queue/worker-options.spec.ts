import { getWorkerConcurrency } from './worker-options';
import { MailProcessor } from '@/infrastructure/mail/queue/mail.processor';
import { OutboxDispatcherProcessor } from './outbox/outbox-dispatcher.processor';

describe('getWorkerConcurrency', () => {
  it('uses the configured concurrency', () => {
    expect(getWorkerConcurrency('1')).toBe(1);
    expect(getWorkerConcurrency('12')).toBe(12);
  });

  it('rejects invalid concurrency', () => {
    expect(() => getWorkerConcurrency('0')).toThrow('WORKER_CONCURRENCY');
    expect(() => getWorkerConcurrency('invalid')).toThrow('WORKER_CONCURRENCY');
  });

  it('applies concurrency to the BullMQ worker metadata', () => {
    expect(
      Reflect.getMetadata('bullmq:worker_metadata', MailProcessor),
    ).toEqual({ concurrency: getWorkerConcurrency() });
    expect(
      Reflect.getMetadata('bullmq:worker_metadata', OutboxDispatcherProcessor),
    ).toEqual({ concurrency: getWorkerConcurrency() });
  });
});
