import { expect, test } from '../fixtures/public-story-test';

test.describe('Full-text search real API', () => {
  test('searches story and chapter text, persists filters in the URL, and opens a result @smoke', async ({
    page,
  }) => {
    await page.goto('/tim-kiem?q=E2E%20Public%20Story');
    const results = page.getByRole('region', { name: 'Kết quả tìm kiếm' });
    await expect(
      results.getByRole('link', { name: 'E2E Public Story', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Nội dung chương', exact: true }).click();
    await page.getByLabel('Từ khóa', { exact: true }).fill('navigation');
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await expect(page).toHaveURL(/q=navigation/u);
    await expect(page).toHaveURL(/kind=chapter/u);
    await expect(results.getByRole('link', { name: 'Tiếp tục E2E', exact: true })).toBeVisible();
    await results.getByRole('link', { name: 'Tiếp tục E2E', exact: true }).click();
    await expect(page).toHaveURL(/\/truyen\/e2e-public-story\/chuong\/2$/u);
  });

  test('search controls fit a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tim-kiem?q=E2E');
    await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Kết quả tìm kiếm' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    const overflow = await page
      .locator('.search-page')
      .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
