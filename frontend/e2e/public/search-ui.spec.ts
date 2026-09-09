import { expect, test } from '@playwright/test';

test.describe('Search UI with controlled API responses', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/client-config', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
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
          },
        },
      }),
    );
    await page.route('**/api/v1/search/filters', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { categories: [{ name: 'Tiên hiệp', slug: 'tien-hiep' }], tags: [] },
        },
      }),
    );
    await page.route(/\/api\/v1\/search\?/u, (route) => {
      const params = new URL(route.request().url()).searchParams;
      const kind = params.get('kind') ?? 'story';
      return route.fulfill({
        json: {
          success: true,
          data: {
            hits: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                kind,
                title: 'Đấu Phá Thương Khung',
                slug: 'dau-pha',
                snippet: 'Một hành trình mới bắt đầu.',
                authorName: 'Thiên Tằm Thổ Đậu',
                categories: ['Tiên hiệp'],
                tags: [],
                storyId: '22222222-2222-4222-8222-222222222222',
                storyTitle: 'Đấu Phá Thương Khung',
                storySlug: 'dau-pha',
                number: kind === 'chapter' ? 1 : null,
                accessState: kind === 'chapter' ? 'LOCKED' : 'FREE',
              },
            ],
            totalHits: 1,
            totalPages: 1,
            page: 1,
            pageSize: 20,
            query: params.get('q') ?? '',
            engine: 'postgres',
            processingTimeMs: 8,
          },
        },
      });
    });
  });
  test('keeps typing done while a result-kind navigation is pending', async ({ page }) => {
    await page.goto('/tim-kiem?q=old');
    await expect(page.getByRole('region', { name: 'Kết quả tìm kiếm' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await page.getByRole('button', { name: 'Nội dung chương', exact: true }).evaluate((button) => {
      (button as HTMLButtonElement).click();
      const input = document.querySelector<HTMLInputElement>('input[name="q"]')!;
      input.value = 'navigation';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page).toHaveURL(/kind=chapter/u);
    await expect(page.getByLabel('Từ khóa', { exact: true })).toHaveValue('navigation');
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await expect(page).toHaveURL(/q=navigation/u);
  });

  for (const width of [1440, 390]) {
    test(`renders search and protected chapter previews at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.goto('/tim-kiem?q=dau%20pha');
      await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
      const results = page.getByRole('region', { name: 'Kết quả tìm kiếm' });
      await expect(
        results.getByRole('link', { name: 'Đấu Phá Thương Khung', exact: true }),
      ).toBeVisible();
      await page.getByRole('combobox', { name: 'Thể loại', exact: true }).selectOption('tien-hiep');
      await expect(page).toHaveURL(/category=tien-hiep/u);
      await page.getByRole('button', { name: 'Nội dung chương', exact: true }).click();
      await expect(results.getByText('Nội dung trả phí · Bản xem trước')).toBeVisible();
      expect(
        await page
          .locator('.search-page')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`search-${width}.png`), fullPage: true });
    });
  }
});
