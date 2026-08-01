/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import mailConfig from './mail.config';

describe('mailConfig', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds SMTP and decodes DKIM configuration', () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.MAIL_MESSAGE_ID_DOMAIN = 'mail.example.test';
    process.env.SMTP_PORT = '587';
    process.env.MAIL_DKIM_PRIVATE_KEY_BASE64 =
      Buffer.from('private-key').toString('base64');
    expect(mailConfig()).toEqual(
      expect.objectContaining({
        enabled: true,
        messageIdDomain: 'mail.example.test',
        smtp: expect.objectContaining({ port: 587 }),
        dkim: expect.objectContaining({ privateKey: 'private-key' }),
      }),
    );
  });
});
