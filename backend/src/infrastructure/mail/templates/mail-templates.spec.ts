import { emailVerificationTemplate } from './email-verification.template';

describe('mail templates', () => {
  it('escapes user content and includes text and HTML alternatives', () => {
    const result = emailVerificationTemplate.render({
      displayName: '<script>alert(1)</script>',
      verificationUrl: 'https://frontend.test/verify?token=abc',
      expiresInMinutes: 30,
    });
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.text).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('rejects non-http action URLs', () => {
    expect(() =>
      emailVerificationTemplate.render({
        displayName: 'User',
        verificationUrl: 'javascript:alert(1)',
        expiresInMinutes: 30,
      }),
    ).toThrow('verificationUrl must use http or https');
  });
});
