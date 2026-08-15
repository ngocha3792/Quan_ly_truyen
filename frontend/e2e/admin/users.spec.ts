import { expect, test } from '../fixtures/managed-admin-test';
import { clickAndAcceptDialog } from '../support/native-dialog';

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
    page.getByRole(
      'heading',

      {
        name: 'Quản lý người dùng',
      },
    ),
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
    .getByRole(
      'link',

      {
        name: 'Chi tiết',
      },
    )
    .click();

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Chi tiết người dùng',
      },
    ),
  ).toBeVisible();

  await clickAndAcceptDialog(
    page,
    page.getByRole(
      'button',

      {
        name: 'Tạm khóa',
      },
    ),
    'Tạm khóa',
  );

  await expect(page.getByText(/Tài khoản đã bị tạm khóa/)).toBeVisible();

  await clickAndAcceptDialog(
    page,
    page.getByRole(
      'button',

      {
        name: 'Kích hoạt',
      },
    ),
  );

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
    .getByRole(
      'link',

      {
        name: 'Chi tiết',
      },
    )
    .click();

  await clickAndAcceptDialog(
    page,
    page.getByRole(
      'button',

      {
        name: 'Cấp quyền ADMIN',
      },
    ),
  );

  await expect(page.getByText(/Đã cấp quyền ADMIN/)).toBeVisible();

  await expect(
    page.getByRole(
      'button',

      {
        name: 'Gỡ quyền ADMIN',
      },
    ),
  ).toBeVisible();

  await clickAndAcceptDialog(
    page,
    page.getByRole(
      'button',

      {
        name: 'Gỡ quyền ADMIN',
      },
    ),
  );

  await expect(page.getByText(/Đã gỡ quyền ADMIN/)).toBeVisible();

  await expect(
    page.getByRole(
      'button',

      {
        name: 'Cấp quyền ADMIN',
      },
    ),
  ).toBeVisible();
});
