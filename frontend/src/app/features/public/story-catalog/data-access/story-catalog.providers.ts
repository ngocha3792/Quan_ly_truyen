import { Provider } from '@angular/core';

import { StoryCatalogHttpRepository } from './story-catalog-http.repository';
import { StoryCatalogRepository } from './story-catalog.repository';
import { StoryCatalogStore } from './story-catalog.store';

export function provideStoryCatalog(): Provider[] {
  return [
    {
      provide: StoryCatalogRepository,
      useClass: StoryCatalogHttpRepository,
    },
    StoryCatalogStore,
  ];
}
