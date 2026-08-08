import type { Response } from 'express';

import { ServiceUnavailableException } from '@/common/exceptions';

import {
  LoginCommandHandler,
  LogoutAllCommandHandler,
  LogoutCommandHandler,
  RefreshTokenCommandHandler,
  RevokeAccessTokenCommandHandler,
} from '../../../application';

import {
  InvalidRefreshTokenException,
  RefreshTokenReuseDetectedException,
} from '../../../domain/exceptions';

import { AuthCookieService } from '../cookies';

import { AuthTokenController } from './auth-token.controller';

describe('AuthTokenController', () => {
  let controller: AuthTokenController;

  let refreshExecute: jest.Mock;

  let readRequiredRefreshToken: jest.Mock;

  let clearAuthCookies: jest.Mock;

  let setNoStoreHeaders: jest.Mock;

  beforeEach(() => {
    refreshExecute = jest.fn();

    readRequiredRefreshToken = jest
      .fn()
      .mockReturnValue('phase-2-refresh-token');

    clearAuthCookies = jest.fn();

    setNoStoreHeaders = jest.fn();

    const loginHandler = {
      execute: jest.fn(),
    } as unknown as LoginCommandHandler;

    const logoutHandler = {
      execute: jest.fn(),
    } as unknown as LogoutCommandHandler;

    const logoutAllHandler = {
      execute: jest.fn(),
    } as unknown as LogoutAllCommandHandler;

    const refreshHandler = {
      execute: refreshExecute,
    } as unknown as RefreshTokenCommandHandler;

    const revokeAccessTokenHandler = {
      execute: jest.fn(),
    } as unknown as RevokeAccessTokenCommandHandler;

    const authCookies = {
      setNoStoreHeaders,

      readRequiredRefreshToken,

      setAuthCookies: jest.fn(),

      clearAuthCookies,

      readOptionalRefreshToken: jest.fn(),

      setOAuthStateCookie: jest.fn(),

      clearOAuthStateCookie: jest.fn(),
    } as unknown as AuthCookieService;

    controller = new AuthTokenController(
      loginHandler,

      logoutHandler,

      logoutAllHandler,

      refreshHandler,

      revokeAccessTokenHandler,

      authCookies,
    );
  });

  it('clear auth cookies khi refresh token không hợp lệ', async () => {
    const response = {} as Response;

    const error = new InvalidRefreshTokenException();

    refreshExecute.mockRejectedValue(error);

    await expect(
      controller.refresh(
        'refresh_token=invalid',

        undefined,

        undefined,

        response,
      ),
    ).rejects.toBe(error);

    expect(readRequiredRefreshToken).toHaveBeenCalledTimes(1);

    expect(clearAuthCookies).toHaveBeenCalledTimes(1);

    expect(clearAuthCookies).toHaveBeenCalledWith(response);
  });

  it('clear auth cookies khi phát hiện refresh token reuse', async () => {
    const response = {} as Response;

    const error = new RefreshTokenReuseDetectedException();

    refreshExecute.mockRejectedValue(error);

    await expect(
      controller.refresh(
        'refresh_token=old-token',

        undefined,

        undefined,

        response,
      ),
    ).rejects.toBe(error);

    expect(clearAuthCookies).toHaveBeenCalledTimes(1);

    expect(clearAuthCookies).toHaveBeenCalledWith(response);
  });

  it('không clear auth cookies khi refresh gặp lỗi backend tạm thời', async () => {
    const response = {} as Response;

    const error = new ServiceUnavailableException({
      code: 'AUTH_REFRESH_TEMPORARILY_UNAVAILABLE',

      message: 'Refresh persistence tạm thời không khả dụng',

      service: 'postgres',
    });

    refreshExecute.mockRejectedValue(error);

    await expect(
      controller.refresh(
        'refresh_token=still-valid',

        undefined,

        undefined,

        response,
      ),
    ).rejects.toBe(error);

    expect(clearAuthCookies).not.toHaveBeenCalled();
  });

  it('không clear auth cookies với unexpected infrastructure error', async () => {
    const response = {} as Response;

    const error = new Error('unexpected database connection failure');

    refreshExecute.mockRejectedValue(error);

    await expect(
      controller.refresh(
        'refresh_token=still-valid',

        undefined,

        undefined,

        response,
      ),
    ).rejects.toBe(error);

    expect(clearAuthCookies).not.toHaveBeenCalled();
  });
});
