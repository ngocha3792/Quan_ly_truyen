import { runBackendScript } from '../support/backend-script';
import { expect, test } from '@playwright/test';

const AUTHOR_EMAIL = 'e2e.lifecycle-author@truyenhub.test';
const AUTHOR_PASSWORD = 'E2eManager@2026';
const SESSION_HINT_KEY = 'truyenhub.auth.has-refresh-session';

test.beforeEach(() => {
  if (process.env['E2E_EXTERNAL'] !== 'true') runBackendScript('db:seed:e2e:admin');
});

test('author analytics page renders aggregate-only metrics and story drill-down', async ({
  page,
}, testInfo) => {
  const login = await page.request.post('/api/v1/auth/login', {
    data: {
      identifier: AUTHOR_EMAIL,
      password: AUTHOR_PASSWORD,
      deviceName: `Playwright Phase6 Author - ${testInfo.title}`,
      deviceId: `playwright-phase6-${testInfo.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}`,
    },
  });
  expect(login.ok(), await login.text()).toBe(true);
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), SESSION_HINT_KEY);

  await page.route('**/api/v1/author/analytics/overview**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          range: { from: '2026-08-01', to: '2026-08-16', timeZone: 'Asia/Ho_Chi_Minh' },
          totals: {
            views: 12,
            uniqueReaders: 7,
            readingStarts: 5,
            completions: 3,
            readingSeconds: 420,
            completionRate: 0.6,
            readingStartRate: 5 / 12,
            averageReadingSecondsPerReaderDay: 60,
          },
          series: [
            {
              date: '2026-08-15',
              views: 0,
              uniqueReaders: 3,
              readingStarts: 2,
              completions: 1,
              readingSeconds: 120,
              completionRate: 0.5,
              readingStartRate: null,
              averageReadingSecondsPerReaderDay: 40,
            },
            {
              date: '2026-08-16',
              views: 12,
              uniqueReaders: 4,
              readingStarts: 3,
              completions: 2,
              readingSeconds: 300,
              completionRate: 2 / 3,
              readingStartRate: 0.25,
              averageReadingSecondsPerReaderDay: 75,
            },
          ],
          dataAvailability: {
            requestedDays: 16,
            recordedDays: 2,
            unrecordedDays: 14,
            lastAggregatedAt: '2026-08-16T12:00:00.000Z',
            seriesMode: 'recorded_days_only',
            audienceMetric: 'sum_of_story_daily_unique_readers',
          },
          freshness: 'Dữ liệu có thể chậm vài phút.',
        },
      }),
    });
  });
  await page.route('**/api/v1/author/analytics/stories?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          range: { from: '2026-08-01', to: '2026-08-16', timeZone: 'Asia/Ho_Chi_Minh' },
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              title: 'E2E Analytics Story',
              slug: 'e2e-analytics-story',
              views: 12,
              uniqueReaders: 7,
              readingStarts: 5,
              completions: 3,
              readingSeconds: 420,
              completionRate: 0.6,
              readingStartRate: 5 / 12,
              averageReadingSecondsPerReaderDay: 60,
              recordedDays: 2,
              lastAggregatedAt: '2026-08-16T12:00:00.000Z',
            },
          ],
          pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        },
      }),
    });
  });
  await page.route(
    '**/api/v1/author/analytics/stories/11111111-1111-4111-8111-111111111111**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            story: {
              id: '11111111-1111-4111-8111-111111111111',
              title: 'E2E Analytics Story',
              slug: 'e2e-analytics-story',
            },
            range: { from: '2026-08-01', to: '2026-08-16', timeZone: 'Asia/Ho_Chi_Minh' },
            totals: {
              views: 12,
              uniqueReaders: 7,
              readingStarts: 5,
              completions: 3,
              readingSeconds: 420,
              completionRate: 0.6,
              readingStartRate: 5 / 12,
              averageReadingSecondsPerReaderDay: 60,
            },
            series: [],
            dataAvailability: {
              requestedDays: 16,
              recordedDays: 2,
              unrecordedDays: 14,
              lastAggregatedAt: '2026-08-16T12:00:00.000Z',
              seriesMode: 'recorded_days_only',
              audienceMetric: 'sum_of_story_daily_unique_readers',
            },
            chapters: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                number: 1,
                title: 'Khởi đầu',
                views: 9,
                uniqueReaders: 6,
                readingStarts: 5,
                completions: 3,
                readingSeconds: 420,
                completionRate: 0.6,
                readingStartRate: 5 / 9,
                averageReadingSecondsPerReaderDay: 70,
              },
            ],
          },
        }),
      });
    },
  );

  await page.goto('/author-studio/thong-ke?days=30');
  await expect(page.getByRole('heading', { name: 'Thống kê độc giả' })).toBeVisible();
  await expect(page.getByText(/2\/16 ngày có bản ghi aggregate/u)).toBeVisible();
  await expect(page.locator('.chart .bar').first()).toHaveCSS('height', '0px');
  await expect(page.getByText('60.0%').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'E2E Analytics Story' })).toBeVisible();
  await page.getByRole('link', { name: 'E2E Analytics Story' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Analytics Story' })).toBeVisible();
  await expect(page.getByText(/Biểu đồ không tự điền 0/u)).toBeVisible();
  await expect(page.getByText('Chưa có ngày nào được ghi nhận')).toBeVisible();
  await expect(page.getByText(/Chương 1.*Khởi đầu/u)).toBeVisible();
  await expect(page.getByText(/reader id|email|anonymous/i)).toHaveCount(0);
});
