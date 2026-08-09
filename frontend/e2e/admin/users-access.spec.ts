import { expect, test } from '../fixtures/authenticated-test';

test('user thiếu user.manage không truy cập được trang quản lý người dùng', async ({ page }) => {
  await page.goto('/admin/users');

  await expect(page).toHaveURL(/\/khong-co-quyen\?reason=permission&from=%2Fadmin%2Fusers$/);

  await expect(
    page.getByRole('heading', {
      name: 'Bạn chưa có quyền truy cập',
      level: 1,
    }),
  ).toBeVisible();
});
