import type { ReadingHistoryPersistencePort } from '../../ports';
import { SaveReadingProgressCommand } from './save-reading-progress.command';
import { SaveReadingProgressCommandHandler } from './save-reading-progress.command-handler';

describe('SaveReadingProgressCommandHandler portable cursor rollout', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const storyId = '22222222-2222-4222-8222-222222222222';
  const chapterId = '33333333-3333-4333-8333-333333333333';

  it('fails closed when the cursor feature is disabled', async () => {
    const saveProgress = jest.fn();
    const persistence = createPersistence(saveProgress);
    const handler = new SaveReadingProgressCommandHandler(
      persistence,
      readerFeatures(false),
    );

    await expect(
      handler.execute(
        new SaveReadingProgressCommand(userId, storyId, chapterId, 0, {
          schemaVersion: 1,
          kind: 'text',
          blockId: '44444444-4444-4444-8444-444444444444',
          characterOffset: 2,
          viewportRatio: 0.5,
        }),
      ),
    ).rejects.toMatchObject({ code: 'READER_PORTABLE_CURSOR_DISABLED' });
    expect(saveProgress).not.toHaveBeenCalled();
  });

  it('passes a normalized portable cursor when enabled', async () => {
    const saveProgress = jest.fn();
    const persistence = createPersistence(saveProgress);
    saveProgress.mockResolvedValue({
      status: 'saved',
      entry: {
        story: {
          id: storyId,
          slug: 'truyen',
          title: 'Truyện',
          author: 'Tác giả',
          coverUrl: null,
          categories: [],
          latestChapterNumber: 1,
          chapterCount: 1,
        },
        currentChapter: { id: chapterId, number: 1, title: 'Chương' },
        position: 0,
        progressPercent: 100,
        lastReadAt: new Date().toISOString(),
      },
    });
    const handler = new SaveReadingProgressCommandHandler(
      persistence,
      readerFeatures(true),
    );

    await handler.execute(
      new SaveReadingProgressCommand(userId, storyId, chapterId, 0, {
        schemaVersion: 1,
        kind: 'comic',
        mediaAssetId: '44444444-4444-4444-8444-444444444444',
        relativeY: 0.25,
      }),
    );

    expect(saveProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: {
          schemaVersion: 1,
          kind: 'comic',
          mediaAssetId: '44444444-4444-4444-8444-444444444444',
          relativeY: 0.25,
        },
      }),
    );
  });
});

function createPersistence(
  saveProgress: jest.MockedFunction<
    ReadingHistoryPersistencePort['saveProgress']
  >,
): jest.Mocked<ReadingHistoryPersistencePort> {
  return {
    listMine: jest.fn(),
    getProgress: jest.fn(),
    getWeeklyStats: jest.fn(),
    saveProgress,
    removeMine: jest.fn(),
    clearMine: jest.fn(),
  };
}

function readerFeatures(portableCursorEnabled: boolean) {
  return {
    contentDocumentEnabled: false,
    portableCursorEnabled,
    realtimeProgressSyncEnabled: false,
    inlineCommentsEnabled: false,
    inlineCommentsReanchorBatchSize: 50,
    inlineCommentsReanchorIntervalMs: 30_000,
    comicDeliveryEnabled: false,
    offlineReadingEnabled: false,
    textToSpeechEnabled: false,
  };
}
