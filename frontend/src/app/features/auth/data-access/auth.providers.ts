import { Provider } from '@angular/core';
import { AuthFeatureHttpRepository } from './auth-http.repository';
import { AuthFeatureMockRepository } from './auth-mock.repository';
import { AuthFeatureRepository } from './auth.repository';
import { AuthFeatureStore } from './auth.store';

export interface ProvideAuthFeatureOptions {
  readonly useMock?: boolean;
}

export function provideAuthFeature(options: ProvideAuthFeatureOptions = {}): Provider[] {
  return [
    {
      provide: AuthFeatureRepository,
      useClass: options.useMock ? AuthFeatureMockRepository : AuthFeatureHttpRepository,
    },
    AuthFeatureStore,
  ];
}
