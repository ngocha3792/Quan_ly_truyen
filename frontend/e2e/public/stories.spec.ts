import { expect, test } from '../fixtures/public-story-test';

test.describe('Public stories real API', () => {
  test('story detail và chapter reader render dữ liệu seed thật @smoke', async ({ page }) => {
    await page.goto('/truyen/e2e-public-story');

    await expect(page.getByRole('heading', { level: 1, name: 'E2E Public Story' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Đọc Chương 2/u })).toBeVisible();
    await expect(page.getByText('Chương 2: Tiếp tục E2E')).toBeVisible();

    await page.getByRole('link', { name: /Đọc Chương 2/u }).click();

    await expect(page).toHaveURL(/\/truyen\/e2e-public-story\/chuong\/2$/u);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /Chương 2:\s*Tiếp tục E2E/u,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Đây là chương thứ hai dùng để kiểm tra navigation.'),
    ).toBeVisible();
    await expect(page.getByText(/Chương trước/u).first()).toBeVisible();
    await expect(page.getByText(/Chương 1:\s*Khởi đầu E2E/u).first()).toBeVisible();
    await expect(page.getByText('Chương tiếp theo')).toHaveCount(0);
  });

  test('draft chapter không thể đọc từ public route', async ({ page }) => {
    await page.goto('/truyen/e2e-public-story/chuong/3');

    await expect(page.getByText(/Không thể tải chương|Không tìm thấy/u)).toBeVisible();
    await expect(page.getByText('Draft private.')).toHaveCount(0);
  });
});
