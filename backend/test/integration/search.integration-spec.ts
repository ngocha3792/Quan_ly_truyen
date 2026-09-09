import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { SearchSourceRepository } from '@/modules/search/infrastructure/persistence/search-source.repository';
import { SearchIndexCoordinator } from '@/modules/search/infrastructure/persistence/search-index.coordinator';
import type {
  SearchDocument,
  SearchInput,
} from '@/modules/search/domain/search.models';
import { sourceHash } from '@/modules/search/infrastructure/meilisearch/search-index.settings';
import { MeilisearchAdapter } from '@/modules/search/infrastructure/meilisearch/meilisearch.adapter';

describe('search PostgreSQL projection, outbox and rebuild', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let source: SearchSourceRepository;
  let authorId: string;
  let storyId: string;
  let chapterId: string;
  const suffix = randomUUID();
  // Do not reuse the author's UUID: trigram search can legitimately match
  // that public penName even after the private body has been removed.
  const privateContent = `privatechaptercontent${randomUUID().replace(/-/gu, '')}`;
  const indexName = `test_search_${suffix.replace(/-/gu, '')}`;
  const input: SearchInput = {
    q: 'dau pha',
    kind: 'story',
    page: 1,
    pageSize: 20,
    sort: 'relevance',
  };
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [SearchSourceRepository],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    source = moduleRef.get(SearchSourceRepository);
    const user = await prisma.user.create({
      data: {
        email: `search-${suffix}@test.dev`,
        username: `s-${suffix}`,
        displayName: 'Search test',
        emailVerifiedAt: new Date(),
      },
    });
    authorId = user.id;
    await prisma.authorProfile.create({
      data: {
        userId: authorId,
        penName: `Độc Giả ${suffix}`,
        slug: `search-${suffix}`,
      },
    });
    const story = await prisma.story.create({
      data: {
        authorId,
        title: 'Đấu Phá Thương Khung',
        slug: `search-${suffix}`,
        synopsis: 'Hành trình tiên hiệp.',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt: new Date(),
      },
    });
    storyId = story.id;
    const chapter = await prisma.chapter.create({
      data: {
        storyId,
        createdById: authorId,
        updatedById: authorId,
        number: 1,
        title: 'Khởi đầu',
        slug: 'khoi-dau',
        content: privateContent,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    chapterId = chapter.id;
  });
  afterAll(async () => {
    if (prisma) {
      if (storyId) await prisma.story.deleteMany({ where: { id: storyId } });
      if (authorId) {
        await prisma.authorProfile.deleteMany({ where: { userId: authorId } });
        await prisma.user.deleteMany({ where: { id: authorId } });
      }
      await prisma.searchDirtyDocument.deleteMany({
        where: { id: { in: [`story_${storyId}`, `chapter_${chapterId}`] } },
      });
      await prisma.searchIndexCheckpoint.deleteMany({ where: { indexName } });
    }
    await moduleRef?.close();
  });

  it('finds accents and typos in PostgreSQL and filters unpublished stories', async () => {
    const result = await source.fallback({ ...input, storyId });
    expect(result.documents.map((doc) => doc.entityId)).toContain(storyId);
    expect(
      (await source.fallback({ ...input, q: 'dau pha thuong khugn', storyId }))
        .total,
    ).toBe(1);
    await prisma.story.update({
      where: { id: storyId },
      data: { visibility: 'PRIVATE' },
    });
    expect((await source.fallback({ ...input, storyId })).total).toBe(0);
    await prisma.story.update({
      where: { id: storyId },
      data: { visibility: 'PUBLIC' },
    });
  });

  it('rolls back the outbox and dirty revision with a rejected business transaction', async () => {
    const before = await prisma.searchDirtyDocument.findUniqueOrThrow({
      where: { id: `story_${storyId}` },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.story.update({
          where: { id: storyId },
          data: { title: 'Rollback test' },
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      (
        await prisma.searchDirtyDocument.findUniqueOrThrow({
          where: { id: before.id },
        })
      ).revision,
    ).toBe(before.revision);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateType: 'search',
          aggregateId: before.id,
          eventType: 'search.document.changed.v1',
        },
      }),
    ).toBeGreaterThan(0);
  });

  it('never indexes or searches a paid body, including a free-to-paid transition', async () => {
    const before = (await source.documents([`chapter_${chapterId}`]))[0];
    expect(
      (
        await source.fallback({
          ...input,
          kind: 'chapter',
          storyId,
          q: privateContent,
        })
      ).total,
    ).toBe(1);
    const price = await prisma.monetizationPriceBand.findFirstOrThrow({
      where: { isActive: true },
    });
    await prisma.chapterMonetization.upsert({
      where: { chapterId },
      create: {
        chapterId,
        accessType: 'PAID',
        priceBandId: price.id,
        creditPrice: price.creditPrice,
        previewContent: 'Xem trước công khai',
      },
      update: {},
    });
    const after = (await source.documents([`chapter_${chapterId}`]))[0];
    expect(after.content).toBe('Xem trước công khai');
    expect(sourceHash(before)).not.toBe(sourceHash(after));
    expect(
      (
        await source.fallback({
          ...input,
          kind: 'chapter',
          storyId,
          q: before.content,
        })
      ).total,
    ).toBe(0);
    const hits = await source.toHits([after], 'xem truoc');
    expect(
      (
        await source.fallback({
          ...input,
          kind: 'chapter',
          storyId,
          q: 'xem truoc',
        })
      ).total,
    ).toBe(1);
    expect(hits[0]?.accessState).toBe('LOCKED');
    await prisma.chapterMonetization.update({
      where: { chapterId },
      data: { unlockPolicy: 'EARLY_ACCESS', freeAt: new Date(Date.now() - 1) },
    });
    expect((await source.toHits([after], 'xem truoc'))[0]?.accessState).toBe(
      'FREE',
    );
    // The public index remains preview-only even when timed access opens.
    expect((await source.documents([`chapter_${chapterId}`]))[0]?.content).toBe(
      'Xem trước công khai',
    );
    expect(JSON.stringify(hits)).not.toContain(before.content);
  });

  it('keeps the active generation on failure, resumes checkpoint and atomically promotes the shadow', async () => {
    const indexes = new Map<string, Map<string, SearchDocument>>();
    const engine = {
      configure: jest.fn((name: string) => {
        if (!indexes.has(name)) indexes.set(name, new Map());
        return Promise.resolve();
      }),
      upsert: jest.fn((name: string, documents: readonly SearchDocument[]) => {
        const index = indexes.get(name)!;
        documents.forEach((doc) => index.set(doc.id, doc));
        return Promise.resolve();
      }),
      remove: jest.fn((name: string, ids: readonly string[]) => {
        ids.forEach((id) => indexes.get(name)?.delete(id));
        return Promise.resolve();
      }),
      drop: jest.fn((name: string) => {
        indexes.delete(name);
        return Promise.resolve();
      }),
    };
    const coordinator = new SearchIndexCoordinator(
      prisma,
      source,
      { failed: jest.fn(), backlog: jest.fn() } as never,
      {
        enabled: true,
        host: 'http://engine.test',
        apiKey: 'test',
        index: indexName,
      },
      engine as never,
    );
    const settle = async () => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        await coordinator.tick();
        const state = await prisma.searchIndexCheckpoint.findUniqueOrThrow({
          where: { indexName },
        });
        if (state.phase === 'IDLE') return state;
      }
      throw new Error('rebuild did not settle');
    };
    const first = await settle();
    expect(first.activeIndex).toBeTruthy();
    await coordinator.rebuild();
    await coordinator.tick();
    engine.upsert.mockRejectedValueOnce(new Error('provider down'));
    await expect(coordinator.tick()).rejects.toThrow('provider down');
    expect(
      (
        await prisma.searchIndexCheckpoint.findUniqueOrThrow({
          where: { indexName },
        })
      ).activeIndex,
    ).toBe(first.activeIndex);
    const second = await settle();
    expect(second.activeIndex).not.toBe(first.activeIndex);
    expect(
      indexes.get(second.activeIndex!)?.get(`chapter_${chapterId}`)?.content,
    ).toBe('Xem trước công khai');
    const before = indexes.get(second.activeIndex!)?.size;
    await coordinator.tick();
    await coordinator.tick();
    expect(indexes.get(second.activeIndex!)?.size).toBe(before);
  });

  (process.env.SEARCH_TEST_MEILI_HOST ? it : it.skip)(
    'indexes with real Meilisearch tasks and finds Vietnamese typos without exporting paid text',
    async () => {
      const adapter = new MeilisearchAdapter({
        enabled: true,
        host: process.env.SEARCH_TEST_MEILI_HOST!,
        apiKey: process.env.SEARCH_TEST_MEILI_KEY ?? '',
        index: indexName,
      });
      const realIndex = `${indexName}_real`;
      try {
        await adapter.configure(realIndex);
        const documents = await source.documents([
          `story_${storyId}`,
          `chapter_${chapterId}`,
        ]);
        await adapter.upsert(realIndex, documents);
        expect(
          (
            await adapter.search(realIndex, {
              ...input,
              q: 'dau pha thuong khugn',
            })
          ).hits.map((hit) => hit.id),
        ).toContain(`story_${storyId}`);
        const paid = await adapter.search(realIndex, {
          ...input,
          kind: 'chapter',
          q: privateContent,
        });
        expect(paid.total).toBe(0);
        await adapter.remove(realIndex, [`story_${storyId}`]);
        expect((await adapter.search(realIndex, input)).total).toBe(0);
      } finally {
        await adapter.drop(realIndex);
      }
    },
  );
});
