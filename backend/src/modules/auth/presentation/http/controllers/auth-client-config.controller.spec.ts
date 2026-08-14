import { ConfigService } from '@nestjs/config';

import { CSRF_HEADER_NAME } from '@/common/constants';

import { AuthClientConfigController } from './auth-client-config.controller';

describe('AuthClientConfigController', () => {
  it('trả về csrf client config từ AuthConfig', () => {
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
