import { expect, test } from '../fixtures/managed-admin-test';

const TARGET_EMAIL = 'e2e.managed-user@truyenhub.test';

test('manager mở được Quản lý người dùng từ menu hồ sơ', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /E2E Manager/ }).click();

  const usersLink = page.getByRole('link', {
    name: 'Quản lý người dùng',
  });

  await expect(usersLink).toBeVisible();

  await usersLink.click();

  await expect(page).toHaveURL(/\/admin\/users$/);

  await expect(
    page.getByRole('heading', {
      name: 'Quản lý người dùng',
    }),
  ).toBeVisible();
});

test('manager suspend rồi activate user end-to-end', async ({ page }) => {
  await page.goto('/admin/users');

  await expect(
    page.getByRole('heading', {
      name: 'Quản lý người dùng',
    }),
  ).toBeVisible();

  await page
    .getByRole('searchbox', {
      name: 'Tìm người dùng',
    })
    .fill(TARGET_EMAIL);

  await page
    .getByRole('button', {
      name: 'Tìm',
      exact: true,
    })
    .click();

  const row = page.getByRole('row').filter({
    hasText: TARGET_EMAIL,
  });

  await expect(row).toBeVisible();

  await row
    .getByRole('link', {
      name: 'Chi tiết',
    })
    .click();

  await expect(
    page.getByRole('heading', {
      name: 'Chi tiết người dùng',
    }),
  ).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Tạm khóa',
    })
    .click();

  await page.getByRole('textbox').fill('Tạm khóa từ Playwright để kiểm tra lifecycle.');
  await page.getByRole('button', { name: 'Xác nhận' }).click();

  await expect(page.getByText(/Tài khoản đã bị tạm khóa/)).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page
    .getByRole('button', {
      name: 'Kích hoạt',
    })
    .click();

  await expect(page.getByText(/Tài khoản đã được kích hoạt/)).toBeVisible();
});

test('manager cấp rồi gỡ ADMIN role end-to-end', async ({ page }) => {
  await page.goto('/admin/users');

  await page
    .getByRole('searchbox', {
      name: 'Tìm người dùng',
    })
    .fill(TARGET_EMAIL);

  await page
    .getByRole('button', {
      name: 'Tìm',
      exact: true,
    })
    .click();

  const row = page.getByRole('row').filter({
    hasText: TARGET_EMAIL,
  });

  await row
    .getByRole('link', {
      name: 'Chi tiết',
    })
    .click();

  page.once('dialog', (dialog) => void dialog.accept());
  await page
    .getByRole('button', {
      name: 'Cấp quyền ADMIN',
    })
    .click();

  await expect(page.getByText(/Đã cấp quyền ADMIN/)).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Gỡ quyền ADMIN',
    }),
  ).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page
    .getByRole('button', {
      name: 'Gỡ quyền ADMIN',
    })
    .click();

  await expect(page.getByText(/Đã gỡ quyền ADMIN/)).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Cấp quyền ADMIN',
    }),
  ).toBeVisible();
});

test('manager xem và revoke session của user end-to-end', async ({ page }) => {
  await page.goto('/admin/users');

  await page
    .getByRole('searchbox', {
      name: 'Tìm người dùng',
    })
    .fill(TARGET_EMAIL);

  await page
    .getByRole('button', {
      name: 'Tìm',
      exact: true,
    })
    .click();

  const userRow = page.getByRole('row').filter({
    hasText: TARGET_EMAIL,
  });

  await userRow.getByRole('link', { name: 'Chi tiết' }).click();

  const sessionRow = page.getByRole('row').filter({
    hasText: 'E2E Target Browser',
  });

  await expect(sessionRow).toBeVisible();
  await expect(sessionRow.getByText('ACTIVE', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await sessionRow.getByRole('button', { name: 'Revoke' }).click();

  await expect(page.getByText('Đã thu hồi phiên đăng nhập.')).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'E2E Target Browser' })
      .getByText('REVOKED', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('USER_SESSION_REVOKED', { exact: true }).first()).toBeVisible();
});
