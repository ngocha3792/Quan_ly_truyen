import { randomUUID } from 'node:crypto';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaStoryPersistence } from '@/modules/stories/infrastructure';
import { TaxonomyService } from '@/modules/taxonomy/application';
import { normalizeTaxonomyName } from '@/modules/taxonomy/domain';
import { PrismaTaxonomyRepository } from '@/modules/taxonomy/infrastructure';

const runId = randomUUID().replaceAll('-', '');
let sequence = 0;
const unique = (prefix: string) =>
  `${prefix}-${runId.slice(0, 10)}-${++sequence}`;

describe('Taxonomy PostgreSQL invariants', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let taxonomy: TaxonomyService;
  let stories: PrismaStoryPersistence;
  let actorId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaTaxonomyRepository,
        TaxonomyService,
        PrismaStoryPersistence,
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    taxonomy = moduleRef.get(TaxonomyService);
    stories = moduleRef.get(PrismaStoryPersistence);
  });

  beforeEach(async () => {
    actorId = await createUserOnly('taxonomy-actor');
  });
  afterEach(async () => cleanup());
  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('normalizes whitespace without forcing display casing', () => {
    expect(normalizeTaxonomyName('  Dark   Fantasy  ')).toBe('Dark Fantasy');
    expect(normalizeTaxonomyName('dark fantasy')).toBe('dark fantasy');
  });

  it('enforces case-insensitive tag names under concurrent create', async () => {
    const base = unique('RaceTag');
    const results = await Promise.allSettled([
      taxonomy.createTag(base, taxAudit()),
      taxonomy.createTag(base.toUpperCase(), taxAudit()),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    await expect(
      prisma.tag.count({
        where: { name: { contains: runId.slice(0, 10), mode: 'insensitive' } },
      }),
    ).resolves.toBe(1);
  });

  it('merges tags atomically and deduplicates StoryTag rows', async () => {
    const source = await taxonomy.createTag(unique('Sci Fi'), taxAudit());
    const target = await taxonomy.createTag(
      unique('Science Fiction'),
      taxAudit(),
    );
    const author = await createAuthor();
    const first = await createStory(author, unique('story-a'));
    const second = await createStory(author, unique('story-b'));
    await prisma.storyTag.createMany({
      data: [
        { storyId: first, tagId: source.id },
        { storyId: first, tagId: target.id },
        { storyId: second, tagId: source.id },
      ],
    });

    const result = await taxonomy.mergeTag(source.id, target.id, taxAudit());
    expect(result.merged).toMatchObject({
      movedStoryCount: 1,
      deduplicatedStoryCount: 1,
    });
    await expect(
      prisma.tag.findUnique({ where: { id: source.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.storyTag.count({ where: { tagId: target.id } }),
    ).resolves.toBe(2);
    await expect(
      prisma.auditLog.count({
        where: { entityType: 'tag', entityId: source.id, action: 'tag.merged' },
      }),
    ).resolves.toBe(1);
  });

  it('blocks hard delete for used taxonomy', async () => {
    const tag = await taxonomy.createTag(unique('UsedTag'), taxAudit());
    const category = await taxonomy.createCategory(
      { name: unique('UsedCategory') },
      taxAudit(),
    );
    const author = await createAuthor();
    const storyId = await createStory(author, unique('story-used'));
    await prisma.storyTag.create({ data: { storyId, tagId: tag.id } });
    await prisma.storyCategory.create({
      data: { storyId, categoryId: category.id, isPrimary: true },
    });

    await expect(taxonomy.deleteTag(tag.id, taxAudit())).rejects.toMatchObject({
      code: 'TAG_IN_USE',
    });
    await expect(
      taxonomy.deleteCategory(category.id, taxAudit()),
    ).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' });
    await expect(
      prisma.storyTag.count({ where: { storyId, tagId: tag.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.storyCategory.count({
        where: { storyId, categoryId: category.id },
      }),
    ).resolves.toBe(1);
  });

  it('preserves an assigned inactive category on existing story but rejects new attachment', async () => {
    const category = await taxonomy.createCategory(
      { name: unique('LegacyCategory') },
      taxAudit(),
    );
    const author = await createAuthor();
    const first = await createStory(author, unique('legacy-story-a'));
    const second = await createStory(author, unique('legacy-story-b'));
    await prisma.storyCategory.create({
      data: { storyId: first, categoryId: category.id, isPrimary: true },
    });
    await taxonomy.updateCategory(category.id, { isActive: false }, taxAudit());

    const keepExisting = await stories.updateDraft({
      userId: author,
      storyId: first,
      categoryIds: [category.id],
      tagIds: [],
      updatedAt: new Date(),
      audit: {},
    });
    expect(keepExisting.status).toBe('updated');

    const attachNew = await stories.updateDraft({
      userId: author,
      storyId: second,
      categoryIds: [category.id],
      tagIds: [],
      updatedAt: new Date(),
      audit: {},
    });
    expect(attachNew).toMatchObject({
      status: 'invalid_categories',
      invalidIds: [category.id],
    });
    await expect(
      prisma.storyCategory.count({
        where: { storyId: first, categoryId: category.id },
      }),
    ).resolves.toBe(1);
  });

  it('rejects hierarchy cycles and deactivating a parent with active children', async () => {
    const parent = await taxonomy.createCategory(
      { name: unique('Parent') },
      taxAudit(),
    );
    const child = await taxonomy.createCategory(
      { name: unique('Child'), parentId: parent.id },
      taxAudit(),
    );
    await expect(
      taxonomy.updateCategory(parent.id, { isActive: false }, taxAudit()),
    ).rejects.toMatchObject({ code: 'CATEGORY_HAS_ACTIVE_CHILDREN' });
    await expect(
      taxonomy.updateCategory(parent.id, { parentId: child.id }, taxAudit()),
    ).rejects.toMatchObject({ code: 'CATEGORY_HIERARCHY_CYCLE' });
  });

  async function createAuthor(): Promise<string> {
    const userId = await createUserOnly('author');
    const marker = unique('pen').toLowerCase();
    await prisma.authorProfile.create({
      data: { userId, penName: marker, slug: marker },
    });
    return userId;
  }

  async function createUserOnly(prefix: string): Promise<string> {
    const marker = unique(prefix).toLowerCase();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        username: marker.slice(0, 45),
        displayName: marker,
      },
    });
    return user.id;
  }

  function taxAudit() {
    return { actorId, requestId: unique('request') };
  }

  async function createStory(
    authorId: string,
    marker: string,
  ): Promise<string> {
    const story = await prisma.story.create({
      data: {
        authorId,
        title: marker,
        slug: marker.toLowerCase(),
        synopsis: 'taxonomy integration',
      },
    });
    return story.id;
  }

  async function cleanup(): Promise<void> {
    const marker = runId.slice(0, 10);
    const users = await prisma.user.findMany({
      where: { email: { contains: marker } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.story.deleteMany({ where: { authorId: { in: userIds } } });
      await prisma.authorProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.tag.deleteMany({
      where: { name: { contains: marker, mode: 'insensitive' } },
    });
    await prisma.category.deleteMany({
      where: { name: { contains: marker, mode: 'insensitive' } },
    });
  }
});
