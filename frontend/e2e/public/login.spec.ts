import { expect, test } from '@playwright/test';

import { E2E_USER_DISPLAY_NAME, E2E_USER_EMAIL, E2E_USER_PASSWORD } from '../fixtures/e2e-user';

import { AuthDialogPage } from '../pages/auth-dialog.page';

test('@smoke người dùng đăng nhập thành công', async ({ page }) => {
  const authDialog = new AuthDialogPage(page);

  await page.goto('/');

  await authDialog.open();

  await authDialog.login(E2E_USER_EMAIL, E2E_USER_PASSWORD);

  const profileButton = page.locator('header .profile-button');

  await expect(profileButton).toBeVisible();

  await expect(profileButton).toContainText(E2E_USER_DISPLAY_NAME);
});

test('hiển thị lỗi khi mật khẩu sai', async ({ page }) => {
  /**
   * Mock riêng login failure.
   *
   * Không làm bẩn Redis rate limiter.
   */
  await page.route(
    '**/api/v1/auth/login',

    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();

        return;
      }

      await route.fulfill({
        status: 401,

        contentType: 'application/json',

        body: JSON.stringify({
          success: false,

          error: {
            code: 'INVALID_CREDENTIALS',

            message: 'Email, tên đăng nhập hoặc mật khẩu không chính xác',

            retryable: false,
          },

          requestId: 'playwright-invalid-login',

          timestamp: new Date().toISOString(),

          path: '/api/v1/auth/login',
        }),
      });
    },
  );

  const authDialog = new AuthDialogPage(page);

  await page.goto('/');

  await authDialog.open();

  await authDialog.login(E2E_USER_EMAIL, 'SaiMatKhau@2026');

  await expect(authDialog.error).toBeVisible();

  await expect(authDialog.error).toContainText(
    'Email, tên đăng nhập hoặc mật khẩu không chính xác',
  );
});
