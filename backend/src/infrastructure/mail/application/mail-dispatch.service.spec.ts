import { ConfigService } from '@nestjs/config';

import {
  createOutboxMessageId,
  MailDispatchService,
} from './mail-dispatch.service';

describe('MailDispatchService', () => {
  const renderer = { render: jest.fn() };
  const sender = { send: jest.fn() };
  const metrics = { recordMail: jest.fn() };
  const tracing = {
    inSpan: jest.fn(
      (_name: string, _attributes: object, work: (span: object) => unknown) =>
        work({ setAttribute: jest.fn() }),
    ),
  };

  beforeEach(() => jest.clearAllMocks());

  it('skips before rendering or sending when mail is disabled', async () => {
    const service = new MailDispatchService(
      new ConfigService({ mail: { enabled: false } }),
      renderer as never,
      sender as never,
      metrics as never,
      tracing as never,
    );
    await expect(
      service.dispatch({
        templateId: 'email-verification.v1',
        recipientEmail: 'user@example.com',
        variables: {},
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'mail-disabled' });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('returns the provider send result when enabled', async () => {
    renderer.render.mockReturnValue({
      subject: 'Subject',
      text: 'Text',
      html: '<p>Text</p>',
      tags: [],
    });
    sender.send.mockResolvedValue({
      messageId: 'provider-1',
      accepted: ['user@example.com'],
      rejected: [],
    });
    const service = new MailDispatchService(
      new ConfigService({
        mail: { enabled: true, messageIdDomain: 'mail.example.com' },
      }),
      renderer as never,
      sender as never,
      metrics as never,
      tracing as never,
    );
    await expect(
      service.dispatch({
        templateId: 'email-verification.v1',
        recipientEmail: 'user@example.com',
        variables: {},
        outboxEventId: 'event-1',
      }),
    ).resolves.toEqual({
      status: 'sent',
      messageId: 'provider-1',
      accepted: ['user@example.com'],
    });
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: '<outbox-event-1@mail.example.com>',
        headers: { 'X-Outbox-Event-Id': 'event-1' },
      }),
    );
  });

  it('creates a stable Message-ID per outbox event', () => {
    expect(createOutboxMessageId('event-1', 'mail.example.com')).toBe(
      createOutboxMessageId('event-1', 'mail.example.com'),
    );
    expect(createOutboxMessageId('event-1', 'mail.example.com')).not.toBe(
      createOutboxMessageId('event-2', 'mail.example.com'),
    );
  });
});
