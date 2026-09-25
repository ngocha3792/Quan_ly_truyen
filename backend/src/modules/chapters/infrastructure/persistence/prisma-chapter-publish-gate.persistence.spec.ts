import { Prisma } from '@/generated/prisma/client';
import { PrismaChapterPersistence } from './prisma-chapter.persistence';

const userId = '11111111-1111-4111-8111-111111111111';
const storyId = '22222222-2222-4222-8222-222222222222';
const chapterId = '33333333-3333-4333-8333-333333333333';

/**
 * Chương truyện tranh không có một chữ nào — nội dung của nó là các trang ảnh.
 * Mọi cổng chặn "chương rỗng" phải hỏi cả `chapter_media`, nếu không truyện
 * tranh không bao giờ xuất bản được.
 */
describe('Publish gates accept a chapter whose content is pages, not text', () => {
  function setup(options: { content: string; pageCount: number }) {
    const chapter = {
      id: chapterId,
      storyId,
      createdById: userId,
      updatedById: userId,
      number: new Prisma.Decimal(1),
      title: 'Chương 1',
      slug: 'chuong-1',
      content: options.content,
      contentDocument: null,
      documentSchemaVersion: null,
      contentFormat: 'MARKDOWN',
      status: 'APPROVED',
      wordCount: 0,
      version: 3,
      scheduledAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: storyId }]),
      story: {
        findFirst: jest.fn().mockResolvedValue({
          id: storyId,
          status: 'PUBLISHED',
          slug: 'truyen',
          title: 'Truyện',
          authorId: userId,
        }),
        update: jest.fn(),
      },
      chapter: {
        findFirst: jest.fn().mockResolvedValue(chapter),
        update: jest.fn().mockResolvedValue({
          ...chapter,
          status: 'PUBLISHED',
          version: 4,
        }),
      },
      chapterMedia: {
        count: jest.fn().mockResolvedValue(options.pageCount),
      },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn(), createMany: jest.fn() },
      storyFollow: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { createMany: jest.fn() },
    };

    const prisma = {
      $transaction: jest.fn((run: (transaction: typeof tx) => unknown) =>
        run(tx),
      ),
    };

    const prismaRoot = {
      ...prisma,
      chapter: {
        findMany: jest.fn().mockResolvedValue([{ id: chapterId, storyId }]),
      },
    };

    return {
      tx,
      prismaRoot,
      persistence: new PrismaChapterPersistence(
        prismaRoot as never,
        {} as never,
        {} as never,
        { build: () => null } as never,
      ),
    };
  }

  const publishInput = {
    userId,
    storyId,
    chapterId,
    publishedAt: new Date('2026-09-25T04:00:00.000Z'),
    audit: { requestId: 'publish-request' },
  };

  const scheduleInput = {
    userId,
    storyId,
    chapterId,
    scheduledAt: new Date('2026-10-01T04:00:00.000Z'),
    audit: { requestId: 'schedule-request' },
  };

  it('publishes a chapter that only has pages', async () => {
    const { tx, persistence } = setup({ content: '', pageCount: 12 });

    const result = await persistence.publish(publishInput);

    expect(result).toMatchObject({ status: 'published' });
    expect(tx.chapterMedia.count).toHaveBeenCalledWith({
      where: { chapterId },
    });
  });

  it('schedules a chapter that only has pages', async () => {
    const { persistence } = setup({ content: '', pageCount: 3 });

    const result = await persistence.schedule(scheduleInput as never);

    expect(result).toMatchObject({ status: 'scheduled' });
  });

  it('still refuses a chapter with neither text nor pages', async () => {
    const { tx, persistence } = setup({ content: '   ', pageCount: 0 });

    await expect(
      persistence.publish(publishInput as never),
    ).resolves.toMatchObject({
      status: 'empty_content',
    });
    expect(tx.chapter.update).not.toHaveBeenCalled();
  });

  // Cổng này không báo lỗi đi đâu cả: nó chỉ bỏ qua. Chương truyện tranh đã
  // hẹn giờ sẽ im lặng không bao giờ lên, không ai biết để mà sửa.
  it('publishes a scheduled chapter that only has pages', async () => {
    const { persistence } = setup({ content: '', pageCount: 5 });

    await expect(
      persistence.publishDueScheduled({
        dueAt: new Date('2026-10-01T04:00:00.000Z'),
        batchSize: 10,
      }),
    ).resolves.toBe(1);
  });

  it('leaves a scheduled chapter with neither text nor pages alone', async () => {
    const { persistence } = setup({ content: '', pageCount: 0 });

    await expect(
      persistence.publishDueScheduled({
        dueAt: new Date('2026-10-01T04:00:00.000Z'),
        batchSize: 10,
      }),
    ).resolves.toBe(0);
  });

  it('does not count pages when the chapter already has text', async () => {
    const { tx, persistence } = setup({
      content: 'Nội dung thật',
      pageCount: 0,
    });

    await persistence.publish(publishInput);

    expect(tx.chapterMedia.count).not.toHaveBeenCalled();
  });
});
