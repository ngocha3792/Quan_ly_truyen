import type { PrismaService } from '@/infrastructure/database';
import type { MediaUrlPort } from '@/modules/media';
import type { TtsProviderPort } from '../../application';
import { PrismaTtsPersistence } from './prisma-tts.persistence';

describe('TTS manifest early-access authorization', () => {
  const deadline = new Date('2026-09-09T12:00:00Z');
  it('rejects locked audio before freeAt and returns it exactly at freeAt without entitlement', async () => {
    const update = jest.fn().mockResolvedValue({});
    const persistence = new PrismaTtsPersistence(
      {
        chapter: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'chapter',
            publishedAt: new Date('2026-09-01T00:00:00Z'),
            monetization: {
              accessType: 'PAID',
              unlockPolicy: 'EARLY_ACCESS',
              freeAt: deadline,
            },
            entitlements: [],
          }),
        },
        ttsManifest: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'manifest',
            chapterId: 'chapter',
            segments: [],
          }),
          update,
        },
      } as unknown as PrismaService,
      {} as MediaUrlPort,
      {} as TtsProviderPort,
    );
    await expect(
      persistence.getManifest(
        'reader',
        'manifest',
        new Date(deadline.getTime() - 1),
      ),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    await expect(
      persistence.getManifest('reader', 'manifest', deadline),
    ).resolves.toMatchObject({ id: 'manifest', chapterId: 'chapter' });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
