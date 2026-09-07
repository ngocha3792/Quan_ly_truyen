import { ConfigService } from '@nestjs/config';

import { MonetizationEnabledGuard } from './monetization-enabled.guard';

describe('MonetizationEnabledGuard', () => {
  it('fails closed while monetization is disabled', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ enabled: false }),
    } as unknown as ConfigService;

    let thrown: unknown;
    try {
      new MonetizationEnabledGuard(config).canActivate();
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'MONETIZATION_NOT_ENABLED' });
  });

  it('allows wallet reads only after the parent flag is enabled', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ enabled: true }),
    } as unknown as ConfigService;

    expect(new MonetizationEnabledGuard(config).canActivate()).toBe(true);
  });
});
