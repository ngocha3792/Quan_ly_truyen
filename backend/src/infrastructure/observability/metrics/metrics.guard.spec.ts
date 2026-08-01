import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MetricsGuard } from './metrics.guard';

describe('MetricsGuard', () => {
  const config = new ConfigService({
    observability: {
      enabled: true,
      metrics: { enabled: true, bearerToken: 'secret-token' },
    },
  });

  it('accepts the configured bearer token', () => {
    const guard = new MetricsGuard(config);
    expect(
      guard.canActivate(contextWithAuthorization('Bearer secret-token')),
    ).toBe(true);
  });

  it('rejects a missing or incorrect token', () => {
    const guard = new MetricsGuard(config);
    expect(() =>
      guard.canActivate(contextWithAuthorization('Bearer wrong')),
    ).toThrow(UnauthorizedException);
  });
});

function contextWithAuthorization(authorization: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization }, ip: '10.0.0.1' }),
    }),
  } as never;
}
