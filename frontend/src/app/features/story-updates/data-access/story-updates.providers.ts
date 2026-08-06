import {
    Provider,
} from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../../../core/config/app-config.token';

import { StoryUpdatesHttpRepository } from './story-updates-http.repository';
import { StoryUpdatesMockRepository } from './story-updates-mock.repository';

import {
    STORY_UPDATES_ENDPOINTS,
    StoryUpdatesRepository,
} from './story-updates.repository';

import { StoryUpdatesStore } from './story-updates.store';

export interface StoryUpdatesProviderOptions {
    readonly useMock: boolean;
}

export function provideStoryUpdates(
    options:
        StoryUpdatesProviderOptions,
): Provider[] {
    return [
        {
            provide:
                STORY_UPDATES_ENDPOINTS,

            deps: [APP_RUNTIME_CONFIG],

            useFactory: (
                config: {
                    readonly apiBaseUrl: string;
                },
            ) => ({
                overview:
                    `${config.apiBaseUrl}/story-updates/overview`,
            }),
        },

        {
            provide:
                StoryUpdatesRepository,

            useClass:
                options.useMock
                    ? StoryUpdatesMockRepository
                    : StoryUpdatesHttpRepository,
        },

        StoryUpdatesStore,
    ];
}