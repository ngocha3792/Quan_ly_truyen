import { ConfigService } from '@nestjs/config';
import * as passport from 'passport';
import { AUTH_STRATEGIES } from '@/common/constants';
import { JwtAccessStrategy } from './jwt-access.strategy';

describe('JwtAccessStrategy', () => {
  it('registers under the guard strategy name', () => {
    const strategy = new JwtAccessStrategy(
      new ConfigService({
        auth: {
          accessTokenSecret: 'test-access-secret-at-least-32-characters',
          issuer: 'issuer',
          audience: 'audience',
        },
      }),
      { validate: jest.fn() } as never,
    );
    const passportModule = passport as unknown as {
      default?: unknown;
    };
    const registry = (passportModule.default ?? passport) as {
      _strategy(name: string): unknown;
    };
    expect(registry._strategy(AUTH_STRATEGIES.JWT_ACCESS)).toBe(strategy);
  });
});
