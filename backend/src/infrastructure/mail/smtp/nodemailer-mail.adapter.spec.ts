import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import { MailDeliveryException } from '../exceptions';
import { NodemailerMailAdapter } from './nodemailer-mail.adapter';

describe('NodemailerMailAdapter', () => {
  const transporter = {
    verify: jest.fn(),
    sendMail: jest.fn(),
    close: jest.fn(),
  };
  let adapter: NodemailerMailAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new NodemailerMailAdapter(
      transporter as unknown as Transporter<SMTPTransport.SentMessageInfo>,
    );
  });

  it('maps a message and result', async () => {
    transporter.sendMail.mockResolvedValue({
      messageId: 'm1',
      accepted: ['to@test.dev'],
      rejected: [],
      response: '250 OK',
    });
    await expect(
      adapter.send({
        to: { address: 'to@test.dev' },
        subject: 'Subject',
        text: 'Text',
        html: '<p>Text</p>',
        messageId: '<outbox-event-1@mail.example.com>',
        correlationId: 'c1',
      }),
    ).resolves.toEqual(expect.objectContaining({ messageId: 'm1' }));
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: '<outbox-event-1@mail.example.com>',
        headers: { 'X-Correlation-Id': 'c1' },
      }),
    );
  });

  it('rejects a result with no accepted recipient', async () => {
    transporter.sendMail.mockResolvedValue({
      messageId: 'm1',
      accepted: [],
      rejected: ['to@test.dev'],
    });
    await expect(
      adapter.send({
        to: { address: 'to@test.dev' },
        subject: 'S',
        text: 'T',
        html: 'H',
      }),
    ).rejects.toBeInstanceOf(MailDeliveryException);
  });

  it('closes the reusable transporter', () => {
    adapter.close();
    expect(transporter.close).toHaveBeenCalled();
  });
});
