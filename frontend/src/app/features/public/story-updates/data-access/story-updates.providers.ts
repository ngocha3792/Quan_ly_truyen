import { Provider } from '@angular/core';

import { StoryUpdatesHttpRepository } from './story-updates-http.repository';
import { StoryUpdatesRepository } from './story-updates.repository';
import { StoryUpdatesStore } from './story-updates.store';

export function provideStoryUpdates(): Provider[] {
  return [
    {
      provide: StoryUpdatesRepository,
      useClass: StoryUpdatesHttpRepository,
    },
    StoryUpdatesStore,
  ];
}
