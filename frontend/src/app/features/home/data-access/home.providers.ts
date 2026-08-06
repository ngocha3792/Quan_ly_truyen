import { Provider } from '@angular/core';
import { HomeHttpRepository } from './home-http.repository';
import { HomeMockRepository } from './home-mock.repository';
import { HomeRepository } from './home.repository';
import { HomeStore } from './home.store';

export interface ProvideHomeOptions {
  readonly useMock?: boolean;
}

export function provideHome(options: ProvideHomeOptions = {}): Provider[] {
  return [
    {
      provide: HomeRepository,
      useClass: options.useMock ? HomeMockRepository : HomeHttpRepository,
    },
    HomeStore,
  ];
}
