/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { UnrecoverableError } from 'bullmq';

import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';

import { MailDeliveryException } from '../exceptions';
import { MailProcessor } from './mail.processor';

describe('MailProcessor', () => {
  const dispatch = jest.fn();
  const processor = new MailProcessor({ dispatch } as any);
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
  } as any;

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
      expect.stringContaining('skipped because mail is disabled'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('accepted by SMTP'),
    );
  });

  it('makes invalid jobs unrecoverable', async () => {
    await expect(
      processor.process({ ...job, name: 'unknown' }),
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
