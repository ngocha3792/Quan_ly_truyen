import { expect, test } from '../fixtures/managed-admin-test';

const AUTHOR_EMAIL = 'e2e.lifecycle-author@truyenhub.test';

test('manager suspend rồi reactivate author lifecycle', async ({ page }) => {
  await page.goto('/admin/authors');

  await expect(
    page.getByRole('heading', {
      name: 'Author lifecycle',
    }),
  ).toBeVisible();

  await page.getByPlaceholder('Tên, slug, email').fill(AUTHOR_EMAIL);

  const row = page.getByRole('row').filter({
    hasText: AUTHOR_EMAIL,
  });

  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Chi tiết' }).click();

  await expect(page.getByRole('heading', { name: 'E2E Lifecycle Pen' })).toBeVisible();

  await page.getByRole('button', { name: 'Suspend' }).click();

  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox')
    .fill('Tạm dừng tác giả từ Playwright để kiểm tra lifecycle.');
  await dialog.getByRole('button', { name: 'Xác nhận' }).click();

  await expect(page.getByText('Đã cập nhật author thành SUSPENDED.')).toBeVisible();
  await expect(page.getByText(/SUSPENDED/).first()).toBeVisible();

  page.once('dialog', (nativeDialog) => void nativeDialog.accept());
  await page.getByRole('button', { name: 'Reactivate' }).click();

  await expect(page.getByText('Đã cập nhật author thành ACTIVE.')).toBeVisible();
  await expect(page.getByText(/ACTIVE/).first()).toBeVisible();
});
