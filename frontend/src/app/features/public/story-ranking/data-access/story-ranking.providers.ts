import { Provider } from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { StoryRankingHttpRepository } from './story-ranking-http.repository';
import { StoryRankingMockRepository } from './story-ranking-mock.repository';

import { STORY_RANKING_ENDPOINTS, StoryRankingRepository } from './story-ranking.repository';

import { StoryRankingStore } from './story-ranking.store';

export interface StoryRankingProviderOptions {
  readonly useMock: boolean;
}

export function provideStoryRanking(options: StoryRankingProviderOptions): Provider[] {
  return [
    {
      provide: STORY_RANKING_ENDPOINTS,

      deps: [APP_RUNTIME_CONFIG],

      useFactory: (config: { readonly apiBaseUrl: string }) => ({
        ranking: `${config.apiBaseUrl}/rankings/stories`,

        summary: `${config.apiBaseUrl}/rankings/stories/summary`,

        genres: `${config.apiBaseUrl}/rankings/genres`,

        trends: `${config.apiBaseUrl}/rankings/stories/trends`,
      }),
    },

    {
      provide: StoryRankingRepository,

      useClass: options.useMock ? StoryRankingMockRepository : StoryRankingHttpRepository,
    },

    StoryRankingStore,
  ];
}
