import { Provider } from '@angular/core';

import { ChapterListStore } from './chapter-list.store';
import { ChapterReaderOfflineAdapter } from './chapter-reader-offline.adapter';
import { ChapterUnlockService } from './chapter-unlock.service';
import { ChapterReaderHttpRepository } from './chapter-reader-http.repository';
import { ChapterReaderLoadCoordinator } from './chapter-reader-load.coordinator';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderSourceService } from './chapter-reader-source.service';
import { ChapterReaderStore } from './chapter-reader.store';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { ReadingProgressLocalState } from './reading-progress-local-state';
import { ReadingProgressOfflineQueueService } from './reading-progress-offline-queue.service';

export function provideChapterReader(): Provider[] {
  return [
    {
      provide: ChapterReaderRepository,
      useClass: ChapterReaderHttpRepository,
    },
    ChapterReaderStore,
    ChapterReaderOfflineAdapter,
    ChapterReaderSourceService,
    ChapterReaderLoadCoordinator,
    ChapterListStore,
    ChapterUnlockService,
    ReadingProgressSyncService,
    ReadingProgressLocalState,
    ReadingProgressOfflineQueueService,
  ];
}
