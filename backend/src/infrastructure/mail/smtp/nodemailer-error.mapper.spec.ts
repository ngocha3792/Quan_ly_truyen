import { mapNodemailerError } from './nodemailer-error.mapper';

describe('mapNodemailerError', () => {
  it('marks connection failures as retryable', () => {
    expect(
      mapNodemailerError(
        Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
      ).retryable,
    ).toBe(true);
  });

  it('marks permanent SMTP failures as non-retryable', () => {
    expect(
      mapNodemailerError(
        Object.assign(new Error('rejected'), { responseCode: 550 }),
      ).retryable,
    ).toBe(false);
  });
});
