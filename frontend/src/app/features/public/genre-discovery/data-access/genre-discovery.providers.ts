import { Provider } from '@angular/core';

import { GenreDiscoveryHttpRepository } from './genre-discovery-http.repository';
import { GenreDiscoveryRepository } from './genre-discovery.repository';
import { GenreDiscoveryStore } from './genre-discovery.store';

export function provideGenreDiscovery(): Provider[] {
  return [
    {
      provide: GenreDiscoveryRepository,
      useClass: GenreDiscoveryHttpRepository,
    },
    GenreDiscoveryStore,
  ];
}
