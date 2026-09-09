import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { MEDIA_URL_BUILDER } from '@/modules/media';
import { PrismaChapterPersistence } from '@/modules/chapters/infrastructure';
import { ChapterEditorMaintenanceScheduler } from '@/modules/chapters/infrastructure/queue/chapter-editor-maintenance.scheduler';
import { GetAuthorChapterVersionQueryHandler } from '@/modules/chapters/application/queries/get-author-chapter-version/get-author-chapter-version.query-handler';
import { GetVersionDiffQueryHandler } from '@/modules/chapters/application/queries/get-version-diff/get-version-diff.query-handler';
import type { ChapterRecord } from '@/modules/chapters/application/ports/chapter.persistence.port';

describe('Author Studio v2 atomic saves, snapshots and retention', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let writer: PrismaChapterPersistence;
  let userId: string;
  let storyId: string;
  let chapter: ChapterRecord;
  const runId = randomUUID();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaChapterPersistence,
        { provide: MEDIA_URL_BUILDER, useValue: { build: () => '' } },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    writer = moduleRef.get(PrismaChapterPersistence);
    const user = await prisma.user.create({
      data: {
        email: `studio-${runId}@test.dev`,
        username: `s-${runId}`,
        displayName: 'Author Studio',
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
    await prisma.authorProfile.create({
      data: { userId, penName: 'Studio', slug: `studio-${runId}` },
    });
    const story = await prisma.story.create({
      data: {
        authorId: userId,
        title: 'Studio',
        slug: `studio-${runId}`,
        synopsis: '',
        status: 'DRAFT',
      },
    });
    storyId = story.id;
    const result = await writer.createDraft({
      userId,
      storyId,
      title: 'Ban đầu',
      content: 'Đoạn giữ nguyên\n\nĐoạn hai',
      wordCount: 6,
      createdAt: new Date(),
      audit: {},
    });
    if (result.status !== 'created') throw new Error(result.status);
    chapter = result.chapter;
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.story.deleteMany({ where: { authorId: userId } });
      await prisma.authorProfile.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await moduleRef?.close();
  });

  it('serializes competing autosaves and retains stable unchanged block IDs', async () => {
    const base = {
      userId,
      storyId,
      chapterId: chapter.id,
      expectedVersion: chapter.version,
      saveType: 'AUTOSAVE' as const,
      updatedAt: new Date(),
      audit: {},
    };
    const results = await Promise.all(
      ['A', 'B'].map((title) => writer.updateDraft({ ...base, title })),
    );
    expect(results.filter((r) => r.status === 'updated')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'version_conflict')).toHaveLength(
      1,
    );
    const saved = results.find((r) => r.status === 'updated');
    if (saved?.status !== 'updated') throw new Error('missing save');
    expect(saved.chapter.contentDocument).toEqual(chapter.contentDocument);
    chapter = saved.chapter;
    const snapshot = await prisma.chapterVersion.findUniqueOrThrow({
      where: {
        chapterId_version: { chapterId: chapter.id, version: chapter.version },
      },
    });
    expect(snapshot.versionType).toBe('AUTOSAVE');
    expect(snapshot.isRetained).toBe(false);
    expect(snapshot.expiresAt).not.toBeNull();
    const input = {
      userId,
      storyId,
      chapterId: chapter.id,
      page: 1,
      pageSize: 20,
    };
    expect(
      (await writer.listOwnedVersions(input))?.items.some(
        (v) => v.version === chapter.version,
      ),
    ).toBe(false);
    expect(
      (
        await writer.listOwnedVersions({ ...input, includeAutosaves: true })
      )?.items.some((v) => v.version === chapter.version),
    ).toBe(true);
  });

  it('promotes a no-op manual save, rejects stale restore, and restores as a new version', async () => {
    await writer.updateDraft({
      userId,
      storyId,
      chapterId: chapter.id,
      expectedVersion: chapter.version,
      title: chapter.title,
      updatedAt: new Date(),
      audit: {},
    });
    const snapshot = await prisma.chapterVersion.findUniqueOrThrow({
      where: {
        chapterId_version: { chapterId: chapter.id, version: chapter.version },
      },
    });
    expect(snapshot).toMatchObject({
      versionType: 'MANUAL_SAVE',
      isRetained: true,
      expiresAt: null,
    });
    const stale = await writer.restoreDraftVersion({
      userId,
      storyId,
      chapterId: chapter.id,
      version: 1,
      expectedVersion: chapter.version - 1,
      restoredAt: new Date(),
      audit: {},
    });
    expect(stale.status).toBe('version_conflict');
    const restored = await writer.restoreDraftVersion({
      userId,
      storyId,
      chapterId: chapter.id,
      version: 1,
      expectedVersion: chapter.version,
      restoredAt: new Date(),
      audit: {},
    });
    if (restored.status !== 'restored') throw new Error(restored.status);
    expect(restored.chapter.version).toBe(chapter.version + 1);
    chapter = restored.chapter;
    const diff = new GetVersionDiffQueryHandler(
      new GetAuthorChapterVersionQueryHandler(writer),
    );
    expect(
      (await diff.execute(userId, storyId, chapter.id, 1, chapter.version))
        .stats.added,
    ).toBe(0);
    await expect(
      diff.execute(randomUUID(), storyId, chapter.id, 1, chapter.version),
    ).rejects.toThrow();
  });

  it('cleans only expired autosaves, preserving retained and current snapshots', async () => {
    const oldVersion = chapter.version;
    const saved = await writer.updateDraft({
      userId,
      storyId,
      chapterId: chapter.id,
      expectedVersion: oldVersion,
      content: 'Nội dung cuối',
      saveType: 'AUTOSAVE',
      updatedAt: new Date(),
      audit: {},
    });
    if (saved.status !== 'updated') throw new Error(saved.status);
    chapter = saved.chapter;
    await prisma.chapterVersion.updateMany({
      where: { chapterId: chapter.id, version: { in: [1, chapter.version] } },
      data: {
        versionType: 'AUTOSAVE',
        isRetained: false,
        expiresAt: new Date(0),
      },
    });
    const cleanup = new ChapterEditorMaintenanceScheduler(prisma, {
      get: () => ({ enabled: true }),
    } as never);
    await cleanup.tick();
    const snapshots = await prisma.chapterVersion.findMany({
      where: { chapterId: chapter.id },
    });
    expect(snapshots.some((v) => v.version === 1)).toBe(false);
    expect(
      snapshots.some((v) => v.version === oldVersion && v.isRetained),
    ).toBe(true);
    expect(snapshots.some((v) => v.version === chapter.version)).toBe(true);
  });
});
