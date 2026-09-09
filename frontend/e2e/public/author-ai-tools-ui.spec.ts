import { expect, test } from '@playwright/test';
import { CHAPTER_ID, EDITOR_URL } from '../support/author-studio-editor-api';
import { CONNECTION_ID, mockAuthorAiApi } from '../support/author-ai-api';

test.describe('AI author tools with controlled API responses', () => {
  test('requires an explicit connection, polls jobs and cancels/retries without modifying content', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorAiApi(context);
    await page.goto(EDITOR_URL);
    const tools = page.getByRole('region', { name: 'Công cụ AI tác giả', exact: true });
    await expect(tools.getByRole('button', { name: 'Chạy phân tích' })).toBeDisabled();
    await expect(tools).toContainText('Không tự động chuyển sang khóa hệ thống.');
    await tools.getByLabel('Kết nối AI', { exact: true }).selectOption(CONNECTION_ID);
    await tools.getByLabel('Công cụ', { exact: true }).selectOption('CHAPTER_SUMMARY');
    await tools.getByRole('button', { name: 'Chạy phân tích' }).click();
    await expect(tools.getByText('Đang chờ', { exact: true })).toBeVisible();
    expect(api.requests).toEqual([
      {
        connectionId: CONNECTION_ID,
        jobType: 'CHAPTER_SUMMARY',
        chapterId: CHAPTER_ID,
        expectedVersion: 2,
      },
    ]);
    await tools.getByRole('button', { name: 'Hủy tác vụ' }).click();
    await expect(tools).toContainText('Đã hủy');
    await tools.getByRole('button', { name: 'Thử lại' }).click();
    await expect(tools.getByText('Đang chờ', { exact: true })).toBeVisible();
    api.finishJob();
    await expect(tools).toContainText('Minh bắt đầu cuộc hành trình.');
    await expect(tools).toContainText('Chưa có dữ liệu chi phí');
    expect(api.saves).toHaveLength(0);
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Nội dung ban đầu.',
    );
  });

  test('shows character timeline and lets authors resolve and reopen consistency warnings', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorAiApi(context);
    api.enableKnowledge();
    await page.goto(EDITOR_URL);
    const knowledge = page.getByRole('region', { name: 'Nhân vật và dòng thời gian', exact: true });
    await expect(knowledge).toContainText('Minh');
    await knowledge.getByRole('button', { name: 'Xác minh nhân vật' }).click();
    await expect(knowledge).toContainText('Đã xác minh');
    await expect(
      knowledge.getByRole('link', { name: 'Chương xuất hiện đầu tiên' }),
    ).toHaveAttribute('href', EDITOR_URL);
    const issues = page.getByRole('region', { name: 'Cảnh báo nhất quán', exact: true });
    await issues.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click();
    await expect(issues.getByText('Đã xử lý', { exact: true })).toBeVisible();
    await issues.getByRole('button', { name: 'Mở lại', exact: true }).click();
    await expect(issues.getByRole('button', { name: 'Bỏ qua cảnh báo' })).toBeVisible();
    expect(api.issueUpdates).toEqual([
      { isResolved: true },
      { isResolved: false, isDismissed: false },
    ]);
    expect(api.saves).toHaveLength(0);
  });

  test('previews and edits translations locally before explicit version-checked import, including mobile layout', async ({
    page,
    context,
  }, testInfo) => {
    const api = await mockAuthorAiApi(context);
    await page.goto(EDITOR_URL);
    const review = page.getByRole('region', { name: 'Duyệt bản dịch', exact: true });
    await expect(review).toBeVisible();
    await review
      .getByLabel('Nội dung bản dịch', { exact: true })
      .fill('The reviewed and corrected draft.');
    await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
    await expect(review.getByLabel('Nội dung bản dịch', { exact: true })).toHaveValue(
      'The reviewed and corrected draft.',
    );
    expect(api.saves).toHaveLength(0);
    expect(api.reviews).toHaveLength(0);
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Nội dung ban đầu.',
    );
    await review.getByRole('button', { name: 'Duyệt và nhập vào chương', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'The reviewed and corrected draft.',
    );
    await expect(page.locator('form.editor > footer')).toContainText('phiên bản 3');
    expect(api.reviews[0]).toMatchObject({
      decision: 'APPROVE',
      expectedVersion: 2,
      generation: 1,
      translatedContent: 'The reviewed and corrected draft.',
    });
    expect(api.saves).toHaveLength(0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      const panel = page.locator('app-ai-author-tools');
      expect(
        await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`author-ai-${width}.png`),
        fullPage: true,
      });
    }
  });

  test('blocks stale imports and requires notes for revision while preserving the chapter', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorAiApi(context);
    await page.goto(EDITOR_URL);
    const review = page.getByRole('region', { name: 'Duyệt bản dịch', exact: true });
    await expect(review).toBeVisible();
    await expect(review.getByRole('button', { name: 'Yêu cầu sửa bản dịch' })).toBeDisabled();
    await page
      .getByRole('textbox', { name: 'Nội dung chương', exact: true })
      .fill('Nội dung tác giả mới viết.');
    await expect(review.getByRole('button', { name: 'Duyệt và nhập vào chương' })).toBeDisabled();
    await page.getByRole('button', { name: 'Lưu chương', exact: true }).click();
    await expect(review).toContainText('Chương đã thay đổi so với nguồn của bản dịch.');
    await review.getByLabel('Ghi chú duyệt', { exact: true }).fill('Sửa lại tên nhân vật.');
    await review.getByRole('button', { name: 'Yêu cầu sửa bản dịch' }).click();
    await expect(review).toContainText('Đã yêu cầu chỉnh sửa.');
    expect(api.reviews[0]).toMatchObject({
      decision: 'REQUEST_REVISION',
      notes: 'Sửa lại tên nhân vật.',
      expectedVersion: 3,
    });
    expect(api.chapter().content).toBe('Nội dung tác giả mới viết.');
    await expect(review.getByRole('button', { name: 'Duyệt và nhập vào chương' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Dịch lại theo ghi chú' }).click();
    await expect(review.getByRole('button', { name: 'Duyệt và nhập vào chương' })).toBeEnabled();
    await review.getByRole('button', { name: 'Từ chối bản dịch' }).click();
    await expect(review).toContainText('Bản dịch đã bị từ chối.');
    expect(api.reviews[1]).toMatchObject({ decision: 'REJECT', generation: 2, expectedVersion: 3 });
    expect(api.chapter().content).toBe('Nội dung tác giả mới viết.');
  });

  test('keeps the editor draft when an import conflicts with another tab', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorAiApi(context);
    api.failReview();
    await page.goto(EDITOR_URL);
    const review = page.getByRole('region', { name: 'Duyệt bản dịch', exact: true });
    await review.getByRole('button', { name: 'Duyệt và nhập vào chương' }).click();
    await expect(page.getByRole('region', { name: 'So sánh xung đột' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Nội dung ban đầu.',
    );
    expect(api.saves).toHaveLength(0);
  });
});
