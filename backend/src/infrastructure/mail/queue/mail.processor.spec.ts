import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';

import {
  SEND_MAIL_JOB,
  type OutboxQueueEnvelope,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';

import { MailDeliveryException } from '../exceptions';
import { MailProcessor } from './mail.processor';

describe('MailProcessor', () => {
  const dispatch = jest.fn();
  const propagation = {
    runWithQueueContext: jest.fn(
      (_metadata: unknown, _fallback: unknown, work: () => unknown) => work(),
    ),
  };
  const processor = new MailProcessor(
    { dispatch } as never,
    propagation as never,
  );
  const job = {
    id: 'job-1',
    name: SEND_MAIL_JOB,
    data: {
      aggregateType: 'mail',
      aggregateId: 'u1',
      eventType: SEND_MAIL_JOB,
      payload: {
        version: 1,
        templateId: 'email-verification.v1',
        recipientEmail: 'user@test.dev',
        variables: {},
      },
      outboxEventId: 'evt-1',
      createdAt: new Date().toISOString(),
    },
  } as unknown as Job<OutboxQueueEnvelope<SendMailJobV1>>;

  beforeEach(() => dispatch.mockReset());

  it('dispatches a valid v1 mail job', async () => {
    dispatch.mockResolvedValue({
      status: 'sent',
      messageId: 'message-1',
      accepted: ['user@test.dev'],
    });
    await expect(processor.process(job)).resolves.toEqual(
      expect.objectContaining({ status: 'sent', messageId: 'message-1' }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ outboxEventId: 'evt-1' }),
    );
  });

  it('returns skipped when mail is disabled without reporting SMTP acceptance', async () => {
    dispatch.mockResolvedValue({
      status: 'skipped',
      reason: 'mail-disabled',
    });
    const logger = (processor as unknown as { logger: { log: jest.Mock } })
      .logger;
    const logSpy = jest.spyOn(logger, 'log');
    await expect(processor.process(job)).resolves.toEqual({
      status: 'skipped',
      reason: 'mail-disabled',
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'skipped' }),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success' }),
    );
  });

  it('makes invalid jobs unrecoverable', async () => {
    await expect(
      processor.process({ ...job, name: 'unknown' } as unknown as Job<
        OutboxQueueEnvelope<SendMailJobV1>
      >),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('rethrows transient delivery errors for retry', async () => {
    dispatch.mockRejectedValue(new MailDeliveryException('temporary', true));
    await expect(processor.process(job)).rejects.toEqual(
      expect.objectContaining({ retryable: true }),
    );
  });

  it('makes non-retryable delivery errors unrecoverable', async () => {
    dispatch.mockRejectedValue(new MailDeliveryException('rejected', false));
    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
