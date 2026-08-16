import { expect, test } from '../fixtures/public-story-test';

test('browser emits one story view and one chapter view while analytics remains fail-soft', async ({
  page,
}) => {
  const eventTypes: string[] = [];
  await page.route('**/api/v1/reader-analytics/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          enabled: true,
          maxBatchSize: 50,
          completionThresholdPercent: 90,
          progressHeartbeatSeconds: 15,
        },
      }),
    });
  });
  await page.route('**/api/v1/reader-analytics/events', async (route) => {
    const body = route.request().postDataJSON() as { events?: Array<{ type?: string }> };
    for (const event of body.events ?? []) if (event.type) eventTypes.push(event.type);
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false }),
    });
  });

  await page.goto('/truyen/e2e-public-story');
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Public Story' })).toBeVisible();
  await page.waitForTimeout(3500);
  expect(eventTypes.filter((type) => type === 'STORY_VIEW')).toHaveLength(1);

  await page.getByRole('link', { name: /Đọc Chương 2/u }).click();
  await expect(page).toHaveURL(/\/truyen\/e2e-public-story\/chuong\/2$/u);
  await expect(page.getByText('Đây là chương thứ hai dùng để kiểm tra navigation.')).toBeVisible();
  await page.waitForTimeout(3500);
  expect(eventTypes.filter((type) => type === 'CHAPTER_VIEW')).toHaveLength(1);

  // Telemetry failure must never replace the reader content with an analytics error state.
  await expect(page.getByText('Đây là chương thứ hai dùng để kiểm tra navigation.')).toBeVisible();
});
