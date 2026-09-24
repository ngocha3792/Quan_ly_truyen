import { expect, test } from '@playwright/test';

const storyId = 'b41c4d0e-6a0e-4d0e-9d61-1f1a2b3c4d5e';
const chapterId = '9f0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d';
const blockId = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const imageUrl = 'https://cdn.test/anh-chuong.jpg';
const markdown = `![anh](${imageUrl})`;
// Đúng dạng production sinh ra: editor chèn ảnh ngay trước chữ nên cả hai nằm
// chung một block, trước đây reader in nguyên chuỗi Markdown lên màn hình.
const source = `${markdown}Chữ đi liền sau ảnh.`;
const timestamp = '2026-09-09T16:56:27.104Z';

test('reader renders an image that shares a block with text instead of its Markdown', async ({
  page,
}) => {
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
    if (path === '/api/v1/stories/anh-lan-chu/chapters/1')
      return ok({
        story: { id: storyId, slug: 'anh-lan-chu', title: 'Truyện kiểm thử' },
        chapter: {
          id: chapterId,
          number: 1,
          title: 'Ảnh lẫn chữ',
          slug: 'anh-lan-chu',
          wordCount: 5,
          views: 0,
          comments: 0,
          publishedAt: timestamp,
          updatedAt: timestamp,
          access: { state: 'FREE', priceCredits: null },
          content: source,
          contentFormat: 'MARKDOWN',
          contentDocument: {
            schemaVersion: 1,
            blocks: [
              {
                id: blockId,
                type: 'paragraph',
                text: source,
                marks: [],
                // Đúng những gì API đọc chương trả về cho block lẫn ảnh.
                segments: [
                  { type: 'image', url: imageUrl, alt: 'anh', offset: 0, length: markdown.length },
                  { type: 'text', text: 'Chữ đi liền sau ảnh.', offset: markdown.length },
                ],
              },
            ],
          },
          documentSchemaVersion: 1,
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
    history.pushState(null, '', '/truyen/anh-lan-chu/chuong/1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  const article = page.locator('.chapter-content');
  await expect(article).toBeVisible();
  await expect(article.locator('img')).toHaveAttribute('src', imageUrl);
  await expect(article.getByText('Chữ đi liền sau ảnh.', { exact: true })).toBeVisible();
  // Đây là lỗi cần chặn tái phát: chuỗi Markdown không được lọt ra màn hình.
  expect(await article.textContent()).not.toContain('![');
  expect(await article.textContent()).not.toContain(imageUrl);

  // Đoạn chữ vẫn phải mang offset của nó trong text nguồn để neo bình luận đúng.
  await expect(article.locator(`[data-block-id="${blockId}"]`)).toHaveAttribute(
    'data-block-offset',
    String(markdown.length),
  );
});
