import { expect, Page, test } from '@playwright/test';

const STORY_ID = '11111111-1111-4111-8111-111111111111';
const TEXT_CHAPTER = '22222222-2222-4222-8222-222222222222';
const MANGA_CHAPTER = '33333333-3333-4333-8333-333333333333';
const EMPTY_CHAPTER = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const timestamp = '2026-09-25T04:00:00.000Z';

function chapter(id: string, number: number, title: string, wordCount: number, pageCount: number) {
  return {
    id,
    storyId: STORY_ID,
    number,
    title,
    slug: `chuong-${number}`,
    status: 'APPROVED',
    wordCount,
    pageCount,
    version: 2,
    scheduledAt: null,
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function mockApi(page: Page): Promise<void> {
  await page.addInitScript(() =>
    localStorage.setItem('truyenhub.auth.has-refresh-session', 'true'),
  );

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });

    if (path.endsWith('/auth/client-config'))
      return ok({
        features: {
          monetizationEnabled: false,
          paymentProviderEnabled: false,
          contentDocumentEnabled: true,
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
        profile: {
          displayName: 'Tác giả',
          penName: 'But danh',
          avatarUrl: '',
          verified: true,
        },
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

    if (path.endsWith(`/author/stories/${STORY_ID}/chapters`))
      return ok([
        chapter(TEXT_CHAPTER, 1, 'Chương chữ', 1200, 0),
        chapter(MANGA_CHAPTER, 2, 'Chương tranh', 0, 18),
        chapter(EMPTY_CHAPTER, 3, 'Chương rỗng', 0, 0),
      ]);

    if (path.endsWith(`/author/stories/${STORY_ID}`))
      return ok({
        id: STORY_ID,
        authorId: USER_ID,
        title: 'Truyện tranh kiểm thử',
        slug: 'truyen-tranh',
        synopsis: 'Tóm tắt',
        languageCode: 'vi',
        status: 'PUBLISHED',
        format: 'MANGA',
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

test.describe('Manga chapters offer publishing with controlled API responses', () => {
  test('shows publish and schedule for a chapter whose content is pages', async ({ page }) => {
    await mockApi(page);

    // Bootstrap a client-only route first: page.route cannot intercept SSR fetches.
    await page.goto('/tim-kiem');
    await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
    await page.evaluate((storyId) => {
      history.pushState(null, '', `/author-studio/truyen/${storyId}/chuong`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, STORY_ID);

    const mangaRow = page.getByRole('row').filter({ hasText: 'Chương tranh' });
    await expect(mangaRow).toBeVisible();

    // Đây là lỗi người dùng báo: chương toàn ảnh không có nút nào để lên bài.
    await expect(mangaRow.getByRole('button', { name: 'Xuất bản ngay' })).toBeVisible();
    await expect(mangaRow.getByRole('button', { name: 'Hẹn giờ' })).toBeVisible();

    // Cột dung lượng nói "0 từ" cho chương 18 trang là vô nghĩa.
    await expect(mangaRow).toContainText('18 trang');

    const textRow = page.getByRole('row').filter({ hasText: 'Chương chữ' });
    await expect(textRow.getByRole('button', { name: 'Xuất bản ngay' })).toBeVisible();
    await expect(textRow).toContainText('1200 từ');

    // Chương không có cả chữ lẫn trang vẫn phải bị chặn.
    const emptyRow = page.getByRole('row').filter({ hasText: 'Chương rỗng' });
    await expect(emptyRow.getByRole('button', { name: 'Xuất bản ngay' })).toHaveCount(0);
    await expect(emptyRow.getByRole('button', { name: 'Hẹn giờ' })).toHaveCount(0);
  });
});
