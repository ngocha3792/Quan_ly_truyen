import { Provider } from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { StoryCatalogHttpRepository } from './story-catalog-http.repository';
import { StoryCatalogMockRepository } from './story-catalog-mock.repository';

import { STORY_CATALOG_ENDPOINTS, StoryCatalogRepository } from './story-catalog.repository';

import { StoryCatalogStore } from './story-catalog.store';

export interface StoryCatalogProviderOptions {
  readonly useMock: boolean;
}

export function provideStoryCatalog(options: StoryCatalogProviderOptions): Provider[] {
  return [
    {
      provide: STORY_CATALOG_ENDPOINTS,

      deps: [APP_RUNTIME_CONFIG],

      useFactory: (config: { readonly apiBaseUrl: string }) => ({
        catalog: `${config.apiBaseUrl}/stories`,

        genres: `${config.apiBaseUrl}/story-genres`,

        ranking: `${config.apiBaseUrl}/stories/ranking`,
      }),
    },

    {
      provide: StoryCatalogRepository,

      useClass: options.useMock ? StoryCatalogMockRepository : StoryCatalogHttpRepository,
    },

    StoryCatalogStore,
  ];
}
