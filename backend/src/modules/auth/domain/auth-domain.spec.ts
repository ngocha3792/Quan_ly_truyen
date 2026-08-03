import { InvalidInputException } from '@/common/exceptions';

import { AuthAccountStatus } from './enums';

import {
  AccountLoginUnavailableException,
  EmailNotVerifiedException,
  InvalidEmailVerificationTokenException,
  InvalidLoginCredentialsException,
  InvalidPasswordResetTokenException,
} from './exceptions';

import {
  AccountLoginPolicy,
  EmailVerificationPolicy,
  PasswordResetPolicy,
} from './policies';

import {
  DisplayNameValueObject,
  EmailValueObject,
  EmailVerificationTokenValueObject,
  LoginIdentifierValueObject,
  LoginPasswordValueObject,
  PasswordResetTokenValueObject,
  PasswordValueObject,
  UsernameValueObject,
} from './value-objects';

describe('Auth domain', () => {
  describe('EmailValueObject', () => {
    it('normalizes an email', () => {
      expect(EmailValueObject.create('  Reader@Example.COM ').value).toBe(
        'reader@example.com',
      );
    });

    it('rejects malformed email', () => {
      expect(() => EmailValueObject.create('not-an-email')).toThrow(
        expect.objectContaining({
          code: 'AUTH_INVALID_EMAIL',
        }),
      );
    });

    it('compares normalized emails', () => {
      const first = EmailValueObject.create('Reader@Example.com');

      const second = EmailValueObject.create('reader@example.com');

      expect(first.equals(second)).toBe(true);
    });
  });

  describe('UsernameValueObject', () => {
    it('normalizes username', () => {
      expect(UsernameValueObject.create('  Reader_01 ').value).toBe(
        'reader_01',
      );
    });

    it.each(['ab', 'reader-name', 'reader name', 'reader@name'])(
      'rejects invalid username %s',
      (username) => {
        expect(() => UsernameValueObject.create(username)).toThrow(
          expect.objectContaining({
            code: 'AUTH_INVALID_USERNAME',
          }),
        );
      },
    );
  });

  describe('DisplayNameValueObject', () => {
    it('normalizes repeated whitespace', () => {
      expect(DisplayNameValueObject.create('  Nguyễn   Văn   A  ').value).toBe(
        'Nguyễn Văn A',
      );
    });

    it('rejects empty display name', () => {
      expect(() => DisplayNameValueObject.create('   ')).toThrow(
        InvalidInputException,
      );
    });
  });

  describe('PasswordValueObject', () => {
    it('accepts a strong password', () => {
      expect(PasswordValueObject.create('StrongPass123!').value).toBe(
        'StrongPass123!',
      );
    });

    it.each([
      'short',
      'alllowercase123!',
      'ALLUPPERCASE123!',
      'NoNumber!',
      'NoSymbol123',
    ])('rejects weak password %s', (password) => {
      expect(() => PasswordValueObject.create(password)).toThrow(
        expect.objectContaining({
          code: 'AUTH_INVALID_PASSWORD',
        }),
      );
    });

    it('rejects password exceeding bcrypt byte limit', () => {
      expect(() => PasswordValueObject.create(`Aa1!${'á'.repeat(70)}`)).toThrow(
        expect.objectContaining({
          code: 'AUTH_INVALID_PASSWORD',
        }),
      );
    });
  });

  describe('Login value objects', () => {
    it('normalizes login identifier', () => {
      expect(
        LoginIdentifierValueObject.create(' Reader@Example.COM ').value,
      ).toBe('reader@example.com');
    });

    it('does not trim login password', () => {
      expect(LoginPasswordValueObject.create(' password ').value).toBe(
        ' password ',
      );
    });

    it('rejects empty login password', () => {
      expect(() => LoginPasswordValueObject.create('')).toThrow(
        InvalidLoginCredentialsException,
      );
    });
  });

  describe('Token value objects', () => {
    const validToken = 'A'.repeat(43);

    it('accepts base64url email verification token', () => {
      expect(EmailVerificationTokenValueObject.create(validToken).value).toBe(
        validToken,
      );
    });

    it('accepts base64url password reset token', () => {
      expect(PasswordResetTokenValueObject.create(validToken).value).toBe(
        validToken,
      );
    });

    it('rejects malformed verification token', () => {
      expect(() =>
        EmailVerificationTokenValueObject.create('invalid token'),
      ).toThrow(InvalidEmailVerificationTokenException);
    });

    it('rejects malformed reset token', () => {
      expect(() =>
        PasswordResetTokenValueObject.create('invalid token'),
      ).toThrow(InvalidPasswordResetTokenException);
    });
  });

  describe('AccountLoginPolicy', () => {
    it('allows an active verified account', () => {
      expect(() =>
        AccountLoginPolicy.assertCanLogin({
          status: AuthAccountStatus.ACTIVE,

          deletedAt: null,

          emailVerifiedAt: new Date(),
        }),
      ).not.toThrow();
    });

    it('rejects an unverified account', () => {
      expect(() =>
        AccountLoginPolicy.assertCanLogin({
          status: AuthAccountStatus.ACTIVE,

          deletedAt: null,

          emailVerifiedAt: null,
        }),
      ).toThrow(EmailNotVerifiedException);
    });

    it.each([
      AuthAccountStatus.SUSPENDED,
      AuthAccountStatus.BANNED,
      AuthAccountStatus.DELETED,
    ])('rejects account status %s', (status) => {
      expect(() =>
        AccountLoginPolicy.assertCanLogin({
          status,
          deletedAt: null,
          emailVerifiedAt: new Date(),
        }),
      ).toThrow(AccountLoginUnavailableException);
    });

    it('rejects a soft-deleted account', () => {
      expect(() =>
        AccountLoginPolicy.assertCanLogin({
          status: AuthAccountStatus.ACTIVE,

          deletedAt: new Date(),

          emailVerifiedAt: new Date(),
        }),
      ).toThrow(AccountLoginUnavailableException);
    });
  });

  describe('Token expiration policies', () => {
    it('creates a 30-minute email verification expiration', () => {
      const now = new Date('2026-08-03T00:00:00.000Z');

      expect(EmailVerificationPolicy.createExpiresAt(now).toISOString()).toBe(
        '2026-08-03T00:30:00.000Z',
      );
    });

    it('creates a 15-minute password reset expiration', () => {
      const now = new Date('2026-08-03T00:00:00.000Z');

      expect(PasswordResetPolicy.createExpiresAt(now).toISOString()).toBe(
        '2026-08-03T00:15:00.000Z',
      );
    });
  });
});
