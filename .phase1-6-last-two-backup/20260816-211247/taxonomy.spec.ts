import { expect, test } from '../fixtures/managed-admin-test';
const AUTHOR_EMAIL = 'e2e.lifecycle-author@truyenhub.test';
const AUTHOR_PASSWORD = 'E2eManager@2026';
const SESSION_HINT_KEY = 'truyenhub.auth.has-refresh-session';

test('manager merges duplicate tag and source disappears', async ({ page }) => {
  await page.goto('/admin/tags');
  await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();

  const sourceRow = page.getByRole('row').filter({ hasText: 'E2E Sci Fi' });
  await expect(sourceRow).toBeVisible();
  await sourceRow.getByRole('button', { name: 'Merge' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Merge into').selectOption({ label: 'E2E Science Fiction' });
  await dialog.getByRole('button', { name: 'Hợp nhất' }).click();

  await expect(page.getByText(/Đã hợp nhất "E2E Sci Fi" vào "E2E Science Fiction"/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'E2E Sci Fi' })).toHaveCount(0);
});

test('deactivated category stays visible and editable on an existing author story', async ({
  page,
}, testInfo) => {
  await page.goto('/admin/categories');
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();

  const categoryRow = page.getByRole('row').filter({ hasText: 'E2E Legacy Fantasy' });
  await expect(categoryRow).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await categoryRow.getByRole('button', { name: 'Deactivate' }).click();
  await expect(
    page.getByText('Đã ngừng hoạt động thể loại; liên kết truyện cũ được giữ nguyên.'),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'E2E Legacy Fantasy' }).getByText('INACTIVE'),
  ).toBeVisible();

  await logoutCurrentSession(page);
  await loginAuthor(page, testInfo.title);
  await page.goto('/author-studio/truyen');

  const storyCard = page.locator('.story-card').filter({ hasText: 'E2E Taxonomy Legacy Story' });
  await expect(storyCard).toBeVisible();
  await storyCard.getByRole('link', { name: 'Chi tiết' }).click();

  await expect(
    page.getByRole('button', { name: /E2E Legacy Fantasy · Không còn sử dụng/ }),
  ).toBeVisible();
  await page
    .getByLabel('Mô tả')
    .fill('Story remains editable after its assigned category is deactivated.');
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
  await expect(page.getByText(/phiên bản 2/)).toBeVisible();
});

async function logoutCurrentSession(page: import('@playwright/test').Page): Promise<void> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === 'csrf_token');
  if (csrf) {
    await page.request.post('/api/v1/auth/logout', { headers: { 'x-csrf-token': csrf.value } });
  }
  await page.evaluate(() => window.localStorage.clear());
}

async function loginAuthor(page: import('@playwright/test').Page, title: string): Promise<void> {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      identifier: AUTHOR_EMAIL,
      password: AUTHOR_PASSWORD,
      deviceName: `Playwright Taxonomy Author - ${title}`,
      deviceId: `playwright-taxonomy-author-${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}`,
    },
  });
  expect(response.ok()).toBe(true);
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), SESSION_HINT_KEY);
}
