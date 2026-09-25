import { expect, Page, test } from '@playwright/test';

const STORY_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_CHAPTER = '22222222-2222-4222-8222-222222222222';
const SECOND_CHAPTER = '33333333-3333-4333-8333-333333333333';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const timestamp = '2026-09-25T04:00:00.000Z';

function chapter(id: string, number: number, title: string) {
  return {
    id,
    storyId: STORY_ID,
    number,
    title,
    slug: `chuong-${number}`,
    status: 'APPROVED',
    wordCount: 1200,
    pageCount: 0,
    version: 2,
    scheduledAt: null,
    publishedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Thân request của lệnh tạo chương mà giao diện gửi lên. */
const createdChapters: Record<string, unknown>[] = [];

async function mockApi(page: Page): Promise<void> {
  await page.addInitScript(() =>
    localStorage.setItem('truyenhub.auth.has-refresh-session', 'true'),
  );

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });

    if (path.endsWith('/auth/client-config'))
      return ok({
        features: {
          monetizationEnabled: false,
          paymentProviderEnabled: false,
          contentDocumentEnabled: false,
          portableCursorEnabled: false,
          realtimeProgressSyncEnabled: false,
          inlineCommentsEnabled: false,
          comicDeliveryEnabled: false,
          offlineReadingEnabled: false,
          textToSpeechEnabled: false,
        },
        passwordPolicy: {
          minimumLength: 8,
          maximumLength: 72,
          maximumBytes: 72,
          requireLowercase: true,
          requireUppercase: true,
          requireNumber: true,
          requireSymbol: true,
        },
        passwordReset: { tokenExpiresInMinutes: 15 },
        csrf: { enabled: false, cookieName: 'csrf', headerName: 'x-csrf-token' },
      });

    if (path.endsWith('/auth/refresh'))
      return ok({
        sessionId: 'author-test',
        accessToken: 'author-test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });

    if (path.endsWith('/auth/me'))
      return ok({
        id: USER_ID,
        email: 'author@test.invalid',
        username: 'author',
        displayName: 'Tác giả',
        emailVerified: true,
        roles: ['author'],
        permissions: ['story.create', 'chapter.create', 'chapter.update.own'],
        sessionId: 'author-test',
        bio: null,
        status: 'ACTIVE',
        emailVerifiedAt: timestamp,
        lastLoginAt: timestamp,
        avatar: null,
        authorProfile: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    if (path.endsWith('/author/dashboard'))
      return ok({
        profile: { displayName: 'Tác giả', penName: 'But danh', avatarUrl: '', verified: true },
        unreadNotifications: 0,
        metrics: [],
        readership: { week: [], month: [], year: [] },
        schedule: [],
        stories: [],
        drafts: [],
        comments: [],
        topStories: [],
        monthlyGoals: [],
      });

    if (path.endsWith(`/author/stories/${STORY_ID}/chapters`)) {
      if (request.method() === 'POST') {
        createdChapters.push(request.postDataJSON() as Record<string, unknown>);
        return ok({
          id: '66666666-6666-4666-8666-666666666666',
          storyId: STORY_ID,
          number: 1.5,
          title: 'Chương chèn',
          slug: 'chuong-1-5',
          content: 'Bổ sung ý',
          status: 'DRAFT',
          wordCount: 3,
          version: 1,
          scheduledAt: null,
          publishedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      return ok([
        chapter(FIRST_CHAPTER, 1, 'Chương một'),
        chapter(SECOND_CHAPTER, 2, 'Chương hai'),
      ]);
    }

    if (path.endsWith(`/author/stories/${STORY_ID}`))
      return ok({
        id: STORY_ID,
        authorId: USER_ID,
        title: 'Truyện kiểm thử',
        slug: 'truyen-kiem-thu',
        synopsis: 'Tóm tắt',
        languageCode: 'vi',
        status: 'PUBLISHED',
        format: 'NOVEL',
        visibility: 'PUBLIC',
        contentRating: 'GENERAL',
        coverMediaId: null,
        publishedAt: timestamp,
        categories: [],
        tags: [],
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    if (path === '/api/v1/notifications')
      return ok({
        notifications: [],
        statistics: { total: 0, unread: 0, saved: 0, receivedToday: 0 },
        settings: {},
        recentActivities: [],
      });

    return ok(null);
  });
}

test.describe('Chèn chương vào giữa hai chương đã có', () => {
  test('mở trình soạn thảo kèm mốc chèn và gửi mốc đó lên khi lưu', async ({ page }) => {
    createdChapters.length = 0;
    await mockApi(page);

    // Vào một route client-side trước: page.route không chặn được fetch của SSR.
    await page.goto('/tim-kiem');
    await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
    await page.evaluate((storyId) => {
      history.pushState(null, '', `/author-studio/truyen/${storyId}/chuong`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, STORY_ID);

    // Chương 1 đã xuất bản vẫn phải chèn được ngay sau nó.
    const firstRow = page.getByRole('row').filter({ hasText: 'Chương một' });
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('link', { name: 'Chèn chương sau' }).click();

    await expect(page).toHaveURL(new RegExp(`chen-sau=${FIRST_CHAPTER}`));
    await expect(page.getByText('sẽ được chèn ngay sau chương bạn đã chọn')).toBeVisible();

    await page.getByLabel('Tiêu đề chương').fill('Chương chèn');
    await page.getByRole('button', { name: 'Lưu chương' }).click();

    await expect.poll(() => createdChapters.length).toBeGreaterThan(0);
    expect(createdChapters[0]).toMatchObject({
      title: 'Chương chèn',
      afterChapterId: FIRST_CHAPTER,
    });
  });
});
