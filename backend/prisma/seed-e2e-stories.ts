import {
  ChapterStatus,
  StoryStatus,
  StoryVisibility,
} from '../src/generated/prisma/enums';
import { assertNotProduction } from '../scripts/shared/environment';
import { createScriptPrismaClient } from '../scripts/shared/prisma-client';

const prisma = createScriptPrismaClient();

const AUTHOR_EMAIL = 'e2e.story.author@truyenhub.test';
const STORY_SLUG = 'e2e-public-story';
const CATEGORY_SLUG = 'e2e-testing';

async function main(): Promise<void> {
  assertNotProduction('Preparing public stories E2E data');

  const now = new Date();
  const author = await prisma.user.upsert({
    where: { email: AUTHOR_EMAIL },
    update: {
      username: 'e2e_story_author',
      displayName: 'E2E Story Author',
      emailVerifiedAt: now,
      deletedAt: null,
    },
    create: {
      email: AUTHOR_EMAIL,
      username: 'e2e_story_author',
      displayName: 'E2E Story Author',
      passwordHash: 'e2e-story-seed-not-for-login',
      emailVerifiedAt: now,
    },
    select: { id: true },
  });

  await prisma.authorProfile.upsert({
    where: { userId: author.id },
    update: {
      penName: 'E2E Story Pen',
      slug: 'e2e-story-pen',
    },
    create: {
      userId: author.id,
      penName: 'E2E Story Pen',
      slug: 'e2e-story-pen',
    },
  });

  const category = await prisma.category.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {
      name: 'E2E Testing',
      isActive: true,
      sortOrder: 999,
    },
    create: {
      name: 'E2E Testing',
      slug: CATEGORY_SLUG,
      isActive: true,
      sortOrder: 999,
    },
    select: { id: true },
  });

  const story = await prisma.story.upsert({
    where: { slug: STORY_SLUG },
    update: {
      authorId: author.id,
      title: 'E2E Public Story',
      synopsis: 'Câu chuyện công khai dùng cho Playwright E2E.',
      status: StoryStatus.PUBLISHED,
      visibility: StoryVisibility.PUBLIC,
      publishedAt: now,
      lastChapterAt: now,
      chapterCount: 2,
      deletedAt: null,
    },
    create: {
      authorId: author.id,
      title: 'E2E Public Story',
      slug: STORY_SLUG,
      synopsis: 'Câu chuyện công khai dùng cho Playwright E2E.',
      status: StoryStatus.PUBLISHED,
      visibility: StoryVisibility.PUBLIC,
      publishedAt: now,
      lastChapterAt: now,
      chapterCount: 2,
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.storyCategory.deleteMany({ where: { storyId: story.id } }),
    prisma.chapter.deleteMany({ where: { storyId: story.id } }),
  ]);

  await prisma.storyCategory.create({
    data: {
      storyId: story.id,
      categoryId: category.id,
      isPrimary: true,
    },
  });

  await prisma.chapter.createMany({
    data: [
      {
        storyId: story.id,
        createdById: author.id,
        updatedById: author.id,
        number: 1,
        title: 'Khởi đầu E2E',
        slug: 'chuong-1-khoi-dau-e2e',
        content: 'Đây là đoạn đầu tiên của chương E2E.\n\nNội dung phải được render từ API thật.',
        status: ChapterStatus.PUBLISHED,
        wordCount: 16,
        publishedAt: now,
      },
      {
        storyId: story.id,
        createdById: author.id,
        updatedById: author.id,
        number: 2,
        title: 'Tiếp tục E2E',
        slug: 'chuong-2-tiep-tuc-e2e',
        content: 'Đây là chương thứ hai dùng để kiểm tra navigation.',
        status: ChapterStatus.PUBLISHED,
        wordCount: 10,
        publishedAt: now,
      },
      {
        storyId: story.id,
        createdById: author.id,
        updatedById: author.id,
        number: 3,
        title: 'Draft không được lộ',
        slug: 'chuong-3-draft-khong-duoc-lo',
        content: 'Draft private.',
        status: ChapterStatus.DRAFT,
        wordCount: 2,
      },
    ],
  });

  console.log('Public stories E2E data ready:', STORY_SLUG);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
