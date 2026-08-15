import { Provider } from '@angular/core';

import { StoryDetailHttpRepository } from './story-http.repository';
import { StoryDetailRepository } from './story.repository';
import { StoryDetailStore } from './story.store';

export function provideStoryDetail(): Provider[] {
  return [
    {
      provide: StoryDetailRepository,
      useClass: StoryDetailHttpRepository,
    },
    StoryDetailStore,
  ];
}
