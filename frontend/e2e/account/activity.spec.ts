import { expect, test } from '../fixtures/authenticated-test';

test('lọc lịch sử theo hoạt động đăng nhập', async ({ page }) => {
  await page.goto('/tai-khoan/hoat-dong');

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Lịch sử hoạt động',

        level: 1,
      },
    ),
  ).toBeVisible();

  await page
    .getByRole(
      'tab',

      {
        name: 'Đăng nhập',
      },
    )
    .click();

  const loginEvents = page.getByText(
    'Đăng nhập thành công',

    {
      exact: true,
    },
  );

  await expect(loginEvents.first()).toBeVisible();

  await expect(
    page.getByText(
      'Đổi mật khẩu',

      {
        exact: true,
      },
    ),
  ).toBeHidden();
});
