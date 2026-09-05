import { expect, test } from '../fixtures/managed-admin-test';

const STORY_TITLE = 'E2E Pending Moderation Story';

test('manager xem queue, mở submission và reject với lý do', async ({ page }) => {
  await page.goto('/admin/stories?status=PENDING');

  await expect(
    page.getByRole('heading', {
      name: 'Duyệt truyện',
    }),
  ).toBeVisible();

  const row = page.getByRole('row').filter({
    hasText: STORY_TITLE,
  });

  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Chi tiết' }).click();

  await expect(page.getByRole('heading', { name: STORY_TITLE })).toBeVisible();
  await expect(page.getByText('E2E moderation chapter')).toBeVisible();

  await page.getByRole('button', { name: 'Từ chối' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Nội dung cần chỉnh sửa trước khi có thể xuất bản.');
  await dialog.getByRole('button', { name: 'Xác nhận từ chối' }).click();

  await expect(page.getByText('Đã từ chối truyện.')).toBeVisible();
  await expect(
    page.locator('app-admin-story-status-badge').getByText('Đã từ chối', { exact: true }),
  ).toBeVisible();
});
