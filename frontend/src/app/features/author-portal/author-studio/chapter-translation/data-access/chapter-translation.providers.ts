import { Provider } from '@angular/core';

import { ChapterTranslationRepository } from '../domain/chapter-translation.repository';
import { ChapterTranslationHttpRepository } from './chapter-translation-http.repository';

export function provideChapterTranslation(): Provider[] {
  return [
    {
      provide: ChapterTranslationRepository,
      useClass: ChapterTranslationHttpRepository,
    },
  ];
}
