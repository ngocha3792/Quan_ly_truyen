import { Provider } from '@angular/core';

import { StoryRankingHttpRepository } from './story-ranking-http.repository';
import { StoryRankingRepository } from './story-ranking.repository';
import { StoryRankingStore } from './story-ranking.store';

export function provideStoryRanking(): Provider[] {
  return [
    {
      provide: StoryRankingRepository,
      useClass: StoryRankingHttpRepository,
    },
    StoryRankingStore,
  ];
}
