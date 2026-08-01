import { ConfigService } from '@nestjs/config';

import { MailDispatchService } from './mail-dispatch.service';

describe('MailDispatchService', () => {
  const renderer = { render: jest.fn() };
  const sender = { send: jest.fn() };

  beforeEach(() => jest.resetAllMocks());

  it('skips before rendering or sending when mail is disabled', async () => {
    const service = new MailDispatchService(
      new ConfigService({ mail: { enabled: false } }),
      renderer as never,
      sender as never,
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
      new ConfigService({ mail: { enabled: true } }),
      renderer as never,
      sender as never,
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
  });
});
