import { PrismaChapterPersistence } from './prisma-chapter.persistence';

const userId = '11111111-1111-4111-8111-111111111111';
const storyId = '22222222-2222-4222-8222-222222222222';
const chapterId = '33333333-3333-4333-8333-333333333333';
const firstPage = '44444444-4444-4444-8444-444444444444';
const secondPage = '55555555-5555-4555-8555-555555555555';

/**
 * Trình duyệt gửi mỗi trang một yêu cầu. Thử lại, bấm hai lần, hay hai tab
 * cùng mở đều có thể gửi lại một trang đã gắn, và lúc đó khoá chính
 * (chapter_id, media_asset_id) vỡ thành "Trang truyện đã tồn tại".
 */
describe('Attaching manga pages tolerates a page the chapter already has', () => {
  function setup(attached: readonly string[] = []) {
    const rows = attached.map((mediaAssetId, index) => ({
      mediaAssetId,
      sortOrder: index,
      altText: null,
      caption: null,
      mediaAsset: {
        secureUrl: `https://cdn.test/${mediaAssetId}.webp`,
        publicUrl: null,
        width: 800,
        height: 1200,
      },
    }));

    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: chapterId }]),
      story: {
        findFirst: jest.fn().mockResolvedValue({
          id: storyId,
          authorId: userId,
          status: 'DRAFT',
        }),
      },
      chapter: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: chapterId, status: 'DRAFT' }),
      },
      mediaAsset: {
        findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(where.id.in.map((id) => ({ id }))),
        ),
      },
      chapterMedia: {
        findMany: jest.fn(
          ({ where }: { where: { mediaAssetId?: { in: string[] } } }) =>
            where.mediaAssetId
              ? Promise.resolve(
                  rows
                    .filter((row) =>
                      where.mediaAssetId!.in.includes(row.mediaAssetId),
                    )
                    .map((row) => ({ mediaAssetId: row.mediaAssetId })),
                )
              : Promise.resolve(rows),
        ),
        aggregate: jest.fn().mockResolvedValue({
          _max: { sortOrder: rows.length ? rows.length - 1 : null },
        }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const prisma = {
      $transaction: jest.fn((run: (transaction: typeof tx) => unknown) =>
        run(tx),
      ),
    };

    return {
      tx,
      persistence: new PrismaChapterPersistence(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    };
  }

  const input = (pages: readonly string[]) => ({
    userId,
    storyId,
    chapterId,
    pages: pages.map((mediaAssetId) => ({ mediaAssetId })),
    audit: { requestId: 'attach-request' },
  });

  it('skips a page already attached instead of failing the whole request', async () => {
    const { tx, persistence } = setup([firstPage]);

    const result = await persistence.attachMedia(
      input([firstPage, secondPage]),
    );

    expect(result.status).toBe('attached');
    expect(tx.chapterMedia.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ mediaAssetId: secondPage, sortOrder: 1 }),
      ],
    });
  });

  it('writes nothing when every page in the request is already attached', async () => {
    const { tx, persistence } = setup([firstPage]);

    const result = await persistence.attachMedia(input([firstPage]));

    expect(result).toMatchObject({ status: 'attached' });
    expect(tx.chapterMedia.createMany).not.toHaveBeenCalled();
  });

  it('collapses a page repeated inside one request', async () => {
    const { tx, persistence } = setup();

    await persistence.attachMedia(input([firstPage, firstPage]));

    expect(tx.chapterMedia.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ mediaAssetId: firstPage, sortOrder: 0 }),
      ],
    });
  });

  it('appends new pages after the pages the chapter already has', async () => {
    const { tx, persistence } = setup([firstPage]);

    await persistence.attachMedia(input([secondPage]));

    expect(tx.chapterMedia.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ mediaAssetId: secondPage, sortOrder: 1 }),
      ],
    });
  });
});
