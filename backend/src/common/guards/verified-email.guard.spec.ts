import type { ExecutionContext } from '@nestjs/common';

import { RoleCode } from '@/common/enums';

import { AccessDeniedException } from '@/common/exceptions';

import type { GuardPrincipal } from './guard-principal.interface';

import { VerifiedEmailGuard } from './verified-email.guard';

describe('VerifiedEmailGuard', () => {
  const guard = new VerifiedEmailGuard();

  it('cho phép principal đã xác minh email', () => {
    expect(
      guard.canActivate(
        contextFor(
          principal({
            emailVerified: true,
          }),
        ),
      ),
    ).toBe(true);
  });

  it('từ chối principal chưa xác minh email', () => {
    expect(() =>
      guard.canActivate(
        contextFor(
          principal({
            emailVerified: false,
          }),
        ),
      ),
    ).toThrow(AccessDeniedException);
  });

  it('trả stable error code EMAIL_VERIFICATION_REQUIRED', () => {
    try {
      guard.canActivate(
        contextFor(
          principal({
            emailVerified: false,
          }),
        ),
      );

      throw new Error('Expected VerifiedEmailGuard to reject the request');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AccessDeniedException);

      expect((error as AccessDeniedException).code).toBe(
        'EMAIL_VERIFICATION_REQUIRED',
      );
    }
  });
});

function principal(overrides: Partial<GuardPrincipal> = {}): GuardPrincipal {
  return {
    userId: 'user-1',

    sessionId: 'session-1',

    email: 'user@example.test',

    emailVerified: true,

    roles: [RoleCode.USER],

    permissions: [],

    ...overrides,
  };
}

function contextFor(user: GuardPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
      }),
    }),
  } as unknown as ExecutionContext;
}
