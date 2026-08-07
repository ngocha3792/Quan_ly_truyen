import { Provider } from '@angular/core';
import { AccountProfileHttpRepository } from './account-profile-http.repository';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountProfileStore } from './account-profile.store';

export interface ProvideAccountProfileOptions {
  readonly useMock?: boolean;
}

export function provideAccountProfile(options: ProvideAccountProfileOptions = {}): Provider[] {
  return [
    {
      provide: AccountProfileRepository,
      useClass: AccountProfileHttpRepository,
    },
    AccountProfileStore,
  ];
}
