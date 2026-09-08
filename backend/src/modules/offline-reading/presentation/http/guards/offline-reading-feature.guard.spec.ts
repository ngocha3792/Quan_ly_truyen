import type { ExecutionContext } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ServiceUnavailableException } from '@/common/exceptions';
import { readerFeaturesConfig } from '@/config';

import { OfflineReadingFeatureGuard } from './offline-reading-feature.guard';

describe('OfflineReadingFeatureGuard', () => {
  it('fails closed when offline reading is disabled', () => {
    const guard = new OfflineReadingFeatureGuard({
      offlineReadingEnabled: false,
    } as ConfigType<typeof readerFeaturesConfig>);
    expect(() => guard.canActivate({} as ExecutionContext)).toThrow(
      ServiceUnavailableException,
    );
  });

  it('allows the request only when the rollout flag is enabled', () => {
    const guard = new OfflineReadingFeatureGuard({
      offlineReadingEnabled: true,
    } as ConfigType<typeof readerFeaturesConfig>);
    expect(guard.canActivate({} as ExecutionContext)).toBe(true);
  });
});
