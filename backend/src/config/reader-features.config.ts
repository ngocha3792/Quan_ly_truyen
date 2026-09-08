import { registerAs } from '@nestjs/config';

import type { ReaderFeaturesConfig } from './config.types';

export const READER_FEATURES_CONFIG_KEY = 'readerFeatures';

export default registerAs(
  READER_FEATURES_CONFIG_KEY,
  (): ReaderFeaturesConfig => ({
    contentDocumentEnabled:
      process.env.READER_CONTENT_DOCUMENT_ENABLED === 'true',
    portableCursorEnabled:
      process.env.READER_PORTABLE_CURSOR_ENABLED === 'true',
    realtimeProgressSyncEnabled:
      process.env.READER_REALTIME_PROGRESS_SYNC_ENABLED === 'true',
    inlineCommentsEnabled:
      process.env.READER_INLINE_COMMENTS_ENABLED === 'true',
    comicDeliveryEnabled: process.env.READER_COMIC_DELIVERY_ENABLED === 'true',
    offlineReadingEnabled:
      process.env.READER_OFFLINE_READING_ENABLED === 'true',
    textToSpeechEnabled: process.env.READER_TEXT_TO_SPEECH_ENABLED === 'true',
  }),
);
