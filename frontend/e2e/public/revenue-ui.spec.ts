import { expect, test } from '@playwright/test';
import { mockRevenueApi, REVENUE_ACCOUNT_ID, REVENUE_REQUEST_ID } from '../support/revenue-api';

test('author reviews fee/tax and submits integer payout with an idempotency key', async ({
  page,
  context,
}) => {
  const api = await mockRevenueApi(context);
  await page.goto('/author-studio/doanh-thu');
  await expect(
    page.getByRole('heading', { name: 'Doanh thu & rút tiền', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Số Credit cần rút', { exact: true }).fill('1001');
  await expect(page.getByRole('definition').filter({ hasText: '2.127.500 VND' })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi yêu cầu rút tiền', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã giữ số Credit' })).toBeVisible();
  const write = api.writes.find((w) => w.path.endsWith('/payout-requests'));
  expect(write?.body).toEqual({ accountId: REVENUE_ACCOUNT_ID, grossAmount: '1001' });
  expect(write?.key).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 960 });
  expect(
    await page
      .locator('.revenue-page .panel')
      .evaluateAll((panels) => panels.every((e) => e.scrollWidth <= e.clientWidth + 1)),
  ).toBe(true);
});

test('admin creates a batch and records manual payout evidence', async ({ page, context }) => {
  const api = await mockRevenueApi(context);
  await page.goto('/admin/revenue');
  await expect(
    page.getByRole('heading', { name: 'Doanh thu & chi trả', exact: true }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: `Chọn yêu cầu ${REVENUE_REQUEST_ID}` }).check();
  await page.getByRole('button', { name: 'Tạo lô (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Ghi kết quả chi trả', exact: true }).click();
  await page.getByLabel('Mã giao dịch ngân hàng', { exact: true }).fill('BANK-TRANSFER-001');
  await page.getByLabel('Mã bằng chứng đối soát', { exact: true }).fill('RECONCILIATION-001');
  await page.getByRole('button', { name: 'Xác nhận kết quả chi trả', exact: true }).click();
  await expect(page.getByText('Hoàn tất', { exact: true })).toBeVisible();
  expect(api.writes.find((w) => w.path.endsWith('/complete'))?.body).toEqual({
    providerTxnId: 'BANK-TRANSFER-001',
    evidenceReference: 'RECONCILIATION-001',
  });
  await page.setViewportSize({ width: 390, height: 960 });
  expect(
    await page
      .locator('.admin-revenue-page .panel')
      .evaluateAll((panels) => panels.every((e) => e.scrollWidth <= e.clientWidth + 1)),
  ).toBe(true);
});
