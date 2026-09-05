import { Provider } from '@angular/core';

import { ChapterListStore } from './chapter-list.store';
import { ChapterReaderHttpRepository } from './chapter-reader-http.repository';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderStore } from './chapter-reader.store';

export function provideChapterReader(): Provider[] {
  return [
    {
      provide: ChapterReaderRepository,
      useClass: ChapterReaderHttpRepository,
    },
    ChapterReaderStore,
    ChapterListStore,
  ];
}
