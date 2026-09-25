import { expect, test } from '@playwright/test';

const storyId = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const chapterId = 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const timestamp = '2026-09-25T06:00:00.000Z';

/** Ba trang, đúng hình dạng API đọc chương trả về sau khi ký URL. */
const pages = [1, 2, 3].map((number) => ({
  mediaAssetId: `media-${number}`,
  sortOrder: number - 1,
  altText: `Trang ${number}`,
  caption: null,
  width: 906,
  height: 1278,
  slices: [
    {
      id: `media-${number}:full`,
      sliceIndex: 0,
      width: 906,
      height: 1278,
      offsetY: 0,
      aspectRatio: 906 / 1278,
      urls: {
        avif: `https://cdn.test.invalid/trang-${number}.avif`,
        webp: `https://cdn.test.invalid/trang-${number}.webp`,
        jpeg: `https://cdn.test.invalid/trang-${number}.jpg`,
      },
    },
  ],
}));

/**
 * Chương truyện tranh không có một chữ nào — `content` rỗng, nội dung nằm ở
 * `chapter_media`. Trước bản vá, response bỏ rơi `media` nên người đọc mở
 * chương ra chỉ thấy trang trắng: không chữ, không ảnh.
 */
test('reader renders manga pages for a chapter that has no text', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });

    if (path === '/api/v1/search/filters') return ok({ categories: [], tags: [] });
    if (path === '/api/v1/reader-analytics/config') return ok({ enabled: false });

    if (path.endsWith('/auth/client-config'))
      return ok({
        features: {
          monetizationEnabled: false,
          paymentProviderEnabled: false,
          contentDocumentEnabled: true,
          portableCursorEnabled: false,
          realtimeProgressSyncEnabled: false,
          inlineCommentsEnabled: false,
          // Đường đọc truyện tranh nằm sau cờ này ở cả hai phía.
          comicDeliveryEnabled: true,
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

    if (path === '/api/v1/stories/truyen-tranh/chapters/1')
      return ok({
        story: { id: storyId, slug: 'truyen-tranh', title: 'Truyện tranh kiểm thử' },
        chapter: {
          id: chapterId,
          number: 1,
          title: 'Chương 1',
          slug: 'chuong-1',
          wordCount: 0,
          views: 0,
          comments: 0,
          publishedAt: timestamp,
          updatedAt: timestamp,
          access: { state: 'FREE', priceCredits: null },
          content: '',
          contentFormat: 'MARKDOWN',
          contentDocument: { schemaVersion: 1, blocks: [] },
          documentSchemaVersion: 1,
          media: pages,
        },
        navigation: { previous: null, next: null },
      });

    if (path.endsWith('/comments'))
      return ok({ items: [], pagination: { totalItems: 0, page: 1, pageSize: 20, totalPages: 0 } });

    return ok(null);
  });

  // Bootstrap a client-only route before navigating: page.route cannot intercept SSR fetches.
  await page.goto('/tim-kiem');
  await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, '', '/truyen/truyen-tranh/chuong/1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  const comic = page.locator('.chapter-comic-media');
  await expect(comic).toBeVisible();

  // Đây là lỗi cần chặn tái phát: chương toàn ảnh ra trang trắng.
  // Cả ba trang phải có mặt, đúng thứ tự đọc.
  const comicPages = comic.locator('section.comic');
  await expect(comicPages).toHaveCount(3);
  await expect(comicPages.nth(0)).toHaveAttribute('aria-label', 'Trang 1');
  await expect(comicPages.nth(1)).toHaveAttribute('aria-label', 'Trang 2');
  await expect(comicPages.nth(2)).toHaveAttribute('aria-label', 'Trang 3');

  // Ảnh render lazy: chỉ trang vào khung nhìn mới dựng thẻ img.
  await expect(comicPages.nth(0).locator('img')).toHaveAttribute(
    'src',
    'https://cdn.test.invalid/trang-1.jpg',
  );

  // Kéo xuống trang cuối để chắc phần lazy cũng dựng được, không chỉ trang đầu.
  await comicPages.nth(2).scrollIntoViewIfNeeded();
  await expect(comicPages.nth(2).locator('img')).toHaveAttribute(
    'src',
    'https://cdn.test.invalid/trang-3.jpg',
  );
});
