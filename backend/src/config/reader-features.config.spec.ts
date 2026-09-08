import readerFeaturesConfig from './reader-features.config';

describe('readerFeaturesConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.READER_CONTENT_DOCUMENT_ENABLED;
    delete process.env.READER_PORTABLE_CURSOR_ENABLED;
    delete process.env.READER_REALTIME_PROGRESS_SYNC_ENABLED;
    delete process.env.READER_INLINE_COMMENTS_ENABLED;
    delete process.env.READER_COMIC_DELIVERY_ENABLED;
    delete process.env.READER_OFFLINE_READING_ENABLED;
    delete process.env.READER_TEXT_TO_SPEECH_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps every Sprint 0 reader capability disabled by default', () => {
    expect(readerFeaturesConfig()).toEqual({
      contentDocumentEnabled: false,
      portableCursorEnabled: false,
      realtimeProgressSyncEnabled: false,
      inlineCommentsEnabled: false,
      inlineCommentsReanchorBatchSize: 50,
      inlineCommentsReanchorIntervalMs: 30_000,
      comicDeliveryEnabled: false,
      offlineReadingEnabled: false,
      textToSpeechEnabled: false,
    });
  });

  it('enables capabilities independently', () => {
    process.env.READER_PORTABLE_CURSOR_ENABLED = 'true';

    expect(readerFeaturesConfig()).toEqual({
      contentDocumentEnabled: false,
      portableCursorEnabled: true,
      realtimeProgressSyncEnabled: false,
      inlineCommentsEnabled: false,
      inlineCommentsReanchorBatchSize: 50,
      inlineCommentsReanchorIntervalMs: 30_000,
      comicDeliveryEnabled: false,
      offlineReadingEnabled: false,
      textToSpeechEnabled: false,
    });
  });
});
