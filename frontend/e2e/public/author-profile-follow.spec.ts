import { runBackendScript } from '../support/backend-script';
import { expect, test } from '../fixtures/authenticated-test';

const AUTHOR_EMAIL = 'e2e.lifecycle-author@truyenhub.test';
const AUTHOR_PASSWORD = 'E2eManager@2026';
const AUTHOR_SLUG = 'e2e-lifecycle-pen';
const SESSION_HINT_KEY = 'truyenhub.auth.has-refresh-session';

test.beforeEach(() => {
  if (process.env['E2E_EXTERNAL'] !== 'true') runBackendScript('db:seed:e2e:admin');
});

test('reader follow state persists across detail, reload and following list', async ({ page }) => {
  await page.goto(`/tac-gia/${AUTHOR_SLUG}`);
  const follow = page.getByRole('button', { name: /Theo dõi tác giả|Đang theo dõi/ });
  await expect(follow).toBeVisible();

  if ((await follow.textContent())?.includes('Đang theo dõi')) await follow.click();
  await page.getByRole('button', { name: 'Theo dõi tác giả' }).click();
  await expect(page.getByRole('button', { name: 'Đang theo dõi' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Đang theo dõi' })).toBeVisible();

  await page.goto('/dang-theo-doi');
  await expect(page.getByRole('link', { name: /E2E Lifecycle Pen/ })).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ theo dõi' }).click();

  await page.goto(`/tac-gia/${AUTHOR_SLUG}`);
  await expect(page.getByRole('button', { name: 'Theo dõi tác giả' })).toBeVisible();
});

test('author edits canonical public profile without changing slug', async ({ page }, testInfo) => {
  await logout(page);
  await loginAuthor(page, testInfo.title);
  await page.goto('/author-studio/ho-so');
  await expect(page.getByRole('heading', { name: 'Hồ sơ tác giả' })).toBeVisible();

  await page.getByLabel('Tên tác giả').fill('E2E Phase Five Author');
  await page.getByLabel('Tiểu sử').fill('Tiểu sử được cập nhật từ Author Studio Phase 5.');
  await page.getByLabel('Website').fill('https://example.com/e2e-author');
  await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();

  await page.getByRole('link', { name: 'Xem hồ sơ công khai' }).click();
  await expect(page).toHaveURL(new RegExp(`/tac-gia/${AUTHOR_SLUG}$`));
  await expect(page.getByRole('heading', { name: 'E2E Phase Five Author' })).toBeVisible();
  await expect(page.getByText('Tiểu sử được cập nhật từ Author Studio Phase 5.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://example.com/e2e-author');
});

async function logout(page: import('@playwright/test').Page): Promise<void> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === 'csrf_token');
  if (csrf) await page.request.post('/api/v1/auth/logout', { headers: { 'x-csrf-token': csrf.value } });
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear()).catch(() => undefined);
}

async function loginAuthor(page: import('@playwright/test').Page, title: string): Promise<void> {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      identifier: AUTHOR_EMAIL,
      password: AUTHOR_PASSWORD,
      deviceName: `Playwright Phase5 Author - ${title}`,
      deviceId: `playwright-phase5-author-${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}`,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), SESSION_HINT_KEY);
}
