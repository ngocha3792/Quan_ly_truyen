import { Provider } from '@angular/core';
import { AccountProfileHttpRepository } from './account-profile-http.repository';
import { AccountProfileMockRepository } from './account-profile-mock.repository';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountProfileStore } from './account-profile.store';

export interface ProvideAccountProfileOptions {
  readonly useMock?: boolean;
}

export function provideAccountProfile(options: ProvideAccountProfileOptions = {}): Provider[] {
  return [
    {
      provide: AccountProfileRepository,
      useClass: options.useMock ? AccountProfileMockRepository : AccountProfileHttpRepository,
    },
    AccountProfileStore,
  ];
}
