import { Provider } from '@angular/core';

import { HomeHttpRepository } from './home-http.repository';
import { HomeRepository } from './home.repository';

export function provideHome(): Provider[] {
  return [
    {
      provide: HomeRepository,
      useClass: HomeHttpRepository,
    },
  ];
}
