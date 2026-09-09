import { expect, test } from '@playwright/test';
import { CHAPTER_ID, EDITOR_URL, mockAuthorEditorApi } from '../support/author-studio-editor-api';

test('sets an early-access window through the author editor and clears it when returning to free', async ({
  page,
  context,
}, testInfo) => {
  const editor = await mockAuthorEditorApi(context);
  const writes: Record<string, unknown>[] = [];
  let pricing: Record<string, unknown> = {
    chapterId: CHAPTER_ID,
    accessType: 'FREE',
    priceBandId: null,
    creditPrice: null,
    previewContent: null,
    version: 1,
    unlockPolicy: 'PERMANENT_PAID',
    freeAt: null,
    paidWindowDays: null,
    updatedAt: '2026-09-09T00:00:00.000Z',
  };
  await context.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path.endsWith('/monetization')) {
      if (route.request().method() === 'PUT') {
        const input = route.request().postDataJSON() as Record<string, unknown>;
        writes.push(input);
        expect(route.request().headers()['x-idempotency-key']).toBeTruthy();
        pricing = { ...pricing, ...input, version: Number(pricing['version']) + 1 };
      }
      return ok(pricing);
    }
    if (path.endsWith('/price-bands'))
      return ok([{ id: 'band-1', label: 'Tiêu chuẩn', creditPrice: '10', isActive: true }]);
    if (path === '/api/v1/notifications')
      return ok({
        notifications: [],
        statistics: { total: 0, unread: 0, saved: 0, receivedToday: 0 },
        settings: {},
        recentActivities: [],
      });
    return route.fallback();
  });
  await page.goto(EDITOR_URL);
  const panel = page.locator('app-chapter-pricing');
  await panel.getByRole('combobox', { name: 'Chế độ', exact: true }).selectOption('PAID');
  await panel.getByRole('combobox', { name: 'Mức giá', exact: true }).selectOption('band-1');
  await panel
    .getByRole('combobox', { name: 'Chính sách mở khóa', exact: true })
    .selectOption('EARLY_ACCESS');
  await panel.getByLabel('Số ngày đọc sớm', { exact: true }).fill('7');
  await panel.getByRole('button', { name: 'Lưu quyền truy cập' }).click();
  await expect(panel).toContainText('Phiên bản giá 2');
  expect(writes[0]).toEqual({
    accessType: 'PAID',
    priceBandId: 'band-1',
    unlockPolicy: 'EARLY_ACCESS',
    paidWindowDays: 7,
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await panel.screenshot({
      path: testInfo.outputPath(`early-access-${width}.png`),
      animations: 'disabled',
    });
  }
  await panel.getByRole('combobox', { name: 'Chế độ', exact: true }).selectOption('FREE');
  await panel.getByRole('button', { name: 'Lưu quyền truy cập' }).click();
  await expect(panel).toContainText('Phiên bản giá 3');
  expect(writes[1]).toEqual({ accessType: 'FREE' });
  expect(editor.saves).toHaveLength(0);
});
