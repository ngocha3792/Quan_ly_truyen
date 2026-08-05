import {
    Provider,
} from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../../../core/config/app-config.token';

import { GenreDiscoveryHttpRepository } from './genre-discovery-http.repository';
import { GenreDiscoveryMockRepository } from './genre-discovery-mock.repository';

import {
    GENRE_DISCOVERY_ENDPOINTS,
    GenreDiscoveryRepository,
} from './genre-discovery.repository';

import { GenreDiscoveryStore } from './genre-discovery.store';

export interface GenreDiscoveryProviderOptions {
    readonly useMock: boolean;
}

export function provideGenreDiscovery(
    options: GenreDiscoveryProviderOptions,
): Provider[] {
    return [
        {
            provide:
                GENRE_DISCOVERY_ENDPOINTS,

            deps: [APP_RUNTIME_CONFIG],

            useFactory: (
                config: {
                    readonly apiBaseUrl: string;
                },
            ) => ({
                genres:
                    `${config.apiBaseUrl}/story-genres`,

                featured:
                    `${config.apiBaseUrl}/story-genres/featured`,

                ranking:
                    `${config.apiBaseUrl}/story-genres/ranking`,

                trending:
                    `${config.apiBaseUrl}/story-genres/trending`,
            }),
        },

        {
            provide:
                GenreDiscoveryRepository,

            useClass: options.useMock
                ? GenreDiscoveryMockRepository
                : GenreDiscoveryHttpRepository,
        },

        GenreDiscoveryStore,
    ];
}