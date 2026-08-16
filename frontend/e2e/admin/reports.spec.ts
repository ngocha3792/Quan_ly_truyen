import { expect, test } from '../fixtures/managed-admin-test';

const REPORT_ROW_TEXT = 'E2E moderation current edited content';
const MODERATION_REASON = 'Nội dung vi phạm cần được moderator xử lý trong Playwright.';

async function openSeededReport(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/reports?status=OPEN&reason=HARASSMENT');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: REPORT_ROW_TEXT });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Xem' }).click();
  await expect(page.getByRole('heading', { name: 'HARASSMENT' })).toBeVisible();
}

test('manager sees immutable evidence, hides comment and resolves report', async ({ page }) => {
  await openSeededReport(page);

  await expect(page.getByRole('heading', { name: 'Reported content' })).toBeVisible();
  await expect(page.getByText('E2E original harassment evidence')).toBeVisible();
  await expect(page.getByText(REPORT_ROW_TEXT)).toBeVisible();
  await expect(page.getByText('Edited after report')).toBeVisible();

  await page
    .getByText('Reason (10–2000)')
    .locator('..')
    .getByRole('textbox')
    .first()
    .fill(MODERATION_REASON);
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.getByText('Đã hide comment.')).toBeVisible();
  await expect(page.getByText('HIDDEN', { exact: true })).toBeVisible();
  await expect(page.getByText('HIDE_COMMENT', { exact: true })).toBeVisible();

  await page
    .getByPlaceholder('Resolution note (ít nhất 10 ký tự)')
    .fill('Đã xác nhận vi phạm và hoàn tất xử lý report.');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(page.getByText('Đã resolve report.')).toBeVisible();
  await expect(page.getByText(/RESOLVED/).first()).toBeVisible();
});

test('manager can hold then restore without corrupting the report workflow', async ({ page }) => {
  await openSeededReport(page);
  const reasonBox = page.getByText('Reason (10–2000)').locator('..').getByRole('textbox').first();
  await reasonBox.fill(MODERATION_REASON);

  await page.getByRole('button', { name: 'Hold', exact: true }).click();
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible();
  await expect(page.getByText('HOLD_COMMENT', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText('VISIBLE', { exact: true })).toBeVisible();
  await expect(page.getByText('RESTORE_COMMENT', { exact: true })).toBeVisible();
});

test('warning is recorded and ban reuses account lifecycle without deleting the comment', async ({
  page,
}) => {
  await openSeededReport(page);
  const reasonBox = page.getByText('Reason (10–2000)').locator('..').getByRole('textbox').first();
  await reasonBox.fill(MODERATION_REASON);
  await page
    .getByText('Warning message')
    .locator('..')
    .getByRole('textbox')
    .last()
    .fill('Vui lòng dừng hành vi quấy rối và tuân thủ quy tắc cộng đồng.');

  await page.getByRole('button', { name: 'Warn user', exact: true }).click();
  await expect(page.getByText('Đã gửi cảnh báo bắt buộc.')).toBeVisible();
  await expect(page.getByText('WARN_USER', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Ban user', exact: true }).click();
  await expect(page.getByText('Đã ban user và invalidate quyền truy cập.')).toBeVisible();
  await expect(page.getByText(/Reported user:.*\(BANNED\)/)).toBeVisible();
  await expect(page.getByText(REPORT_ROW_TEXT)).toBeVisible();
  await expect(page.getByText('BAN_USER', { exact: true })).toBeVisible();
});
