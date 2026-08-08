import { expect, test } from '../fixtures/managed-admin-test';

test('reviewer duyệt hồ sơ tác giả end-to-end', async ({ page }) => {
  await page.goto('/admin/author-applications');

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Xét duyệt hồ sơ tác giả',
      },
    ),
  ).toBeVisible();

  await page.getByPlaceholder('Tìm theo họ tên, bút danh hoặc email...').fill('E2E Approve Pen');

  await page
    .getByRole(
      'button',

      {
        name: 'Tìm kiếm',
      },
    )
    .click();

  const row = page.getByRole('row').filter({
    hasText: 'E2E Approve Pen',
  });

  await expect(row).toBeVisible();

  await row
    .getByRole(
      'link',

      {
        name: 'Xem hồ sơ',
      },
    )
    .click();

  await expect(
    page.getByRole(
      'heading',

      {
        name: 'Chi tiết hồ sơ tác giả',
      },
    ),
  ).toBeVisible();

  await expect(page.getByText('E2E Approve Pen')).toBeVisible();

  await page
    .getByRole(
      'button',

      {
        name: 'Duyệt hồ sơ',
      },
    )
    .click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();

  await dialog
    .getByRole(
      'button',

      {
        name: 'Duyệt hồ sơ',
      },
    )
    .click();

  await expect(page.getByText('Đã duyệt')).toBeVisible();

  await expect(page.getByText(/Hồ sơ đã được duyệt/)).toBeVisible();
});

test('reviewer từ chối hồ sơ và lưu rejection reason', async ({ page }) => {
  await page.goto('/admin/author-applications');

  await page.getByPlaceholder('Tìm theo họ tên, bút danh hoặc email...').fill('E2E Reject Pen');

  await page
    .getByRole(
      'button',

      {
        name: 'Tìm kiếm',
      },
    )
    .click();

  const row = page.getByRole('row').filter({
    hasText: 'E2E Reject Pen',
  });

  await row
    .getByRole(
      'link',

      {
        name: 'Xem hồ sơ',
      },
    )
    .click();

  await page
    .getByRole(
      'button',

      {
        name: 'Từ chối',
      },
    )
    .click();

  const dialog = page.getByRole('dialog');

  const reason = 'Mẫu nội dung E2E cần được chỉnh sửa trước khi gửi lại.';

  await dialog.getByLabel('Lý do từ chối').fill(reason);

  await dialog
    .getByRole(
      'button',

      {
        name: 'Xác nhận từ chối',
      },
    )
    .click();

  await expect(page.getByText('Đã từ chối')).toBeVisible();

  await expect(page.getByText(reason)).toBeVisible();
});
