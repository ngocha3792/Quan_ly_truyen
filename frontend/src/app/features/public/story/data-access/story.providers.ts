import { Provider } from '@angular/core';
import { StoryDetailHttpRepository } from './story-http.repository';
import { StoryDetailMockRepository } from './story-mock.repository';
import { StoryDetailRepository } from './story.repository';
import { StoryDetailStore } from './story.store';

export interface ProvideStoryDetailOptions {
  readonly useMock?: boolean;
}

export function provideStoryDetail(options: ProvideStoryDetailOptions = {}): Provider[] {
  return [
    {
      provide: StoryDetailRepository,
      useClass: options.useMock ? StoryDetailMockRepository : StoryDetailHttpRepository,
    },
    StoryDetailStore,
  ];
}
