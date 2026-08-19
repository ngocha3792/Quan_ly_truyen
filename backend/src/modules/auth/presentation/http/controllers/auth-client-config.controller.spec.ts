import { ConfigService } from '@nestjs/config';

import { CSRF_HEADER_NAME } from '@/common/constants';

import { PasswordPolicy, PasswordResetPolicy } from '../../../domain';

import { AuthClientConfigController } from './auth-client-config.controller';

describe('AuthClientConfigController', () => {
  it('trả về auth client config từ domain policy và AuthConfig', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue({
        csrf: {
          enabled: true,
          cookieName: 'runtime_csrf_cookie',
        },
      }),
    } as unknown as ConfigService;

    const controller = new AuthClientConfigController(configService);

    expect(controller.getClientConfig()).toEqual({
      passwordPolicy: {
        minimumLength: PasswordPolicy.MIN_LENGTH,
        maximumLength: PasswordPolicy.MAX_LENGTH,
        maximumBytes: PasswordPolicy.MAX_BYTES,
        requireLowercase: PasswordPolicy.REQUIRE_LOWERCASE,
        requireUppercase: PasswordPolicy.REQUIRE_UPPERCASE,
        requireNumber: PasswordPolicy.REQUIRE_NUMBER,
        requireSymbol: PasswordPolicy.REQUIRE_SYMBOL,
      },
      passwordReset: {
        tokenExpiresInMinutes: PasswordResetPolicy.TTL_MINUTES,
      },
      csrf: {
        enabled: true,
        cookieName: 'runtime_csrf_cookie',
        headerName: CSRF_HEADER_NAME,
      },
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(configService.getOrThrow).toHaveBeenCalledWith('auth');
  });
});
