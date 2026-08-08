import { expect, test } from '../fixtures/authenticated-test';

test('authenticated USER được vào thư viện', async ({ page }) => {
  await page.goto('/thu-vien');

  await expect(page).toHaveURL(/\/thu-vien$/);

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Thư viện của tôi',

        level: 1,
      },
    ),
  ).toBeVisible();
});

test('USER không được vào Author Studio', async ({ page }) => {
  await page.goto('/author-studio');

  await expect(page).toHaveURL(/\/khong-co-quyen\?reason=role/);

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Bạn chưa có quyền truy cập',
      },
    ),
  ).toBeVisible();

  await expect(
    page.getByRole(
      'link',

      {
        name: 'Đăng ký trở thành tác giả',
      },
    ),
  ).toBeVisible();
});

test('reload protected route vẫn restore session', async ({ page }) => {
  await page.goto('/tai-khoan/bao-mat');

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Bảo mật tài khoản',

        level: 1,
      },
    ),
  ).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/tai-khoan\/bao-mat$/);

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Bảo mật tài khoản',

        level: 1,
      },
    ),
  ).toBeVisible();
});
