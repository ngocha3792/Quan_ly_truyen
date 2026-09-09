import { expect, Page, test } from '@playwright/test';
import { EDITOR_URL, mockAuthorEditorApi } from '../support/author-studio-editor-api';

async function openEditor(page: Page): Promise<void> {
  await page.goto(EDITOR_URL);
  await expect(page.getByRole('heading', { name: 'Chỉnh sửa chương', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toBeEditable();
}

test.describe('Author Studio editor with controlled API responses', () => {
  test('submits the saved version, locks review content, and reopens an approved unpublished chapter', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorEditorApi(context, { storyStatus: 'DRAFT' });
    await openEditor(page);
    const editor = page.getByRole('textbox', { name: 'Nội dung chương', exact: true });
    await editor.fill('Bản hoàn chỉnh gửi người duyệt.');
    await page.getByRole('button', { name: 'Lưu và gửi duyệt', exact: true }).click();
    await expect(editor).not.toBeEditable();
    await expect(page.getByRole('region', { name: 'Quy trình duyệt chương' })).toContainText(
      'Đang chờ duyệt, nội dung được khóa.',
    );
    expect(api.saves[0].input).toMatchObject({
      expectedVersion: 2,
      content: 'Bản hoàn chỉnh gửi người duyệt.',
    });
    expect(api.transitions).toEqual([
      { action: 'submit-review', expectedVersion: 3, idempotencyKey: expect.any(String) },
    ]);
    expect(api.chapter().status).toBe('IN_REVIEW');
    api.setChapterStatus('APPROVED');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Mở lại bản nháp để chỉnh sửa' })).toBeEnabled();
    await page.getByRole('button', { name: 'Mở lại bản nháp để chỉnh sửa' }).click();
    await expect(editor).toBeEditable();
    expect(api.transitions.at(-1)).toEqual({
      action: 'reopen',
      expectedVersion: 5,
      idempotencyKey: expect.any(String),
    });
    expect(api.chapter().status).toBe('DRAFT');
    await expect(editor).toHaveText('Bản hoàn chỉnh gửi người duyệt.');
  });

  test('lets a chapter reviewer read the exact version and send a reasoned review decision', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorEditorApi(context, { reviewer: true, chapterStatus: 'IN_REVIEW' });
    await page.goto('/admin/chapter-reviews');
    await expect(page.getByRole('heading', { name: 'Duyệt chương', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Đọc và duyệt', exact: true }).click();
    const review = page.getByRole('region', { name: 'Chương đang viết', exact: true });
    await expect(review).toContainText('Phiên bản 2');
    await expect(review.locator('.chapter-content')).toHaveText('Nội dung ban đầu.');
    await review.getByRole('combobox', { name: 'Quyết định' }).selectOption('REQUEST_CHANGES');
    const submit = review.getByRole('button', { name: 'Lưu quyết định' });
    await expect(submit).toBeDisabled();
    await review
      .getByRole('textbox', { name: 'Nhận xét' })
      .fill('  Bổ sung phần kết của chương.  ');
    await submit.click();
    await expect(page.getByText('Đã lưu quyết định duyệt chương.', { exact: true })).toBeVisible();
    await expect(page.getByText('Không có chương chờ duyệt', { exact: true })).toBeVisible();
    expect(api.reviews).toEqual([
      {
        expectedVersion: 2,
        decision: 'REQUEST_CHANGES',
        comment: 'Bổ sung phần kết của chương.',
        idempotencyKey: expect.any(String),
      },
    ]);
    expect(api.chapter().status).toBe('DRAFT');
    expect(api.chapter().version).toBe(3);
  });

  test('debounces rich text edits and preserves typing during an in-flight autosave', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorEditorApi(context);
    await openEditor(page);
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const editor = page.getByRole('textbox', { name: 'Nội dung chương', exact: true });
    api.holdNextSave();
    await editor.fill('Nội dung gửi lần đầu.');
    await page.clock.runFor(2499);
    expect(api.saves).toHaveLength(0);
    await page.clock.runFor(1);
    await expect.poll(() => api.saves.length).toBe(1);
    await page.clock.resume();
    expect(api.saves[0].input).toMatchObject({
      expectedVersion: 2,
      content: 'Nội dung gửi lần đầu.',
    });
    await expect(page.locator('.autosave-status')).toContainText('Đang lưu');
    await editor.fill('Nội dung gõ thêm trong lúc đang lưu.');
    api.releaseSave();
    await expect(page.locator('form.editor > footer')).toContainText('phiên bản 3');
    await expect(editor).toHaveText('Nội dung gõ thêm trong lúc đang lưu.');
    await expect.poll(() => api.saves.length).toBe(2);
    expect(api.saves[1].input).toMatchObject({
      expectedVersion: 3,
      content: 'Nội dung gõ thêm trong lúc đang lưu.',
    });
    await expect(page.locator('.autosave-status')).toContainText('Đã lưu');
    expect(api.chapter().version).toBe(4);
  });

  test('recovers actual IndexedDB content after refresh without silently saving it', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorEditorApi(context);
    await openEditor(page);
    await page
      .getByRole('textbox', { name: 'Nội dung chương', exact: true })
      .fill('Bản nháp cần khôi phục sau khi tải lại.');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number>((resolve, reject) => {
              const request = indexedDB.open('truyenhub-author-recovery', 2);
              request.onsuccess = () => {
                const database = request.result;
                const get = database
                  .transaction('scoped-drafts', 'readonly')
                  .objectStore('scoped-drafts')
                  .getAll();
                get.onsuccess = () => {
                  database.close();
                  resolve(
                    get.result.filter((entry: { content: string }) =>
                      entry.content.includes('Bản nháp cần khôi phục'),
                    ).length,
                  );
                };
                get.onerror = () => reject(get.error);
              };
              request.onerror = () => reject(request.error);
            }),
        ),
      )
      .toBe(1);
    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    const recovery = page.getByRole('region', { name: 'Khôi phục bản nháp', exact: true });
    await expect(recovery).toBeVisible();
    expect(api.saves).toHaveLength(0);
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Nội dung ban đầu.',
    );
    await recovery.getByRole('button', { name: 'Tiếp tục bản nháp này' }).click();
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Bản nháp cần khôi phục sau khi tải lại.',
    );
    await page.getByRole('button', { name: 'Lưu chương', exact: true }).click();
    await expect(page.locator('.autosave-status')).toContainText('Đã lưu');
    expect(api.chapter().content).toBe('Bản nháp cần khôi phục sau khi tải lại.');
  });

  test('shows both versions for two tabs and retries only after explicit conflict resolution', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorEditorApi(context);
    await openEditor(page);
    const second = await context.newPage();
    await openEditor(second);
    await page
      .getByRole('textbox', { name: 'Nội dung chương', exact: true })
      .fill('Bản của tab thứ nhất.');
    await page.getByRole('button', { name: 'Lưu chương', exact: true }).click();
    await expect(page.locator('.autosave-status')).toContainText('Đã lưu');
    await second
      .getByRole('textbox', { name: 'Nội dung chương', exact: true })
      .fill('Bản của tab thứ hai vẫn được giữ.');
    await second.getByRole('button', { name: 'Lưu chương', exact: true }).click();
    const conflict = second.getByRole('region', { name: 'So sánh xung đột' });
    await expect(conflict).toContainText('Bản của tab thứ nhất.');
    await expect(conflict).toContainText('Bản của tab thứ hai vẫn được giữ.');
    await expect(second.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Bản của tab thứ hai vẫn được giữ.',
    );
    expect(api.saves.map((save) => save.input.expectedVersion)).toEqual([2, 2]);
    await conflict.getByRole('button', { name: 'Lưu bản đang viết thành phiên bản mới' }).click();
    await expect(conflict).not.toBeVisible();
    await expect(second.locator('.autosave-status')).toContainText('Đã lưu');
    expect(api.saves.map((save) => save.input.expectedVersion)).toEqual([2, 2, 3]);
    expect(api.chapter().version).toBe(4);
    await second.close();
  });

  test('restores a historical snapshot with expectedVersion and renders a new version on desktop and mobile', async ({
    page,
    context,
  }, testInfo) => {
    const api = await mockAuthorEditorApi(context);
    await page.setViewportSize({ width: 1440, height: 960 });
    await openEditor(page);
    const history = page.getByRole('region', { name: 'Lịch sử phiên bản', exact: true });
    await history
      .locator('article.version-row')
      .filter({ hasText: 'v1 · Bản đầu tiên' })
      .getByRole('button', { name: 'Xem bản này' })
      .click();
    await expect(history.locator('.preview')).toContainText('Nội dung phiên bản một.');
    page.once('dialog', (dialog) => dialog.accept());
    await history.getByRole('button', { name: 'Khôi phục bản này' }).click();
    await expect(page.getByRole('textbox', { name: 'Nội dung chương', exact: true })).toHaveText(
      'Nội dung phiên bản một.',
    );
    await expect(page.locator('form.editor > footer')).toContainText('phiên bản 3');
    expect(api.restores).toEqual([
      { version: 1, expectedVersion: 2, idempotencyKey: expect.any(String) },
    ]);
    expect(api.chapter().version).toBe(3);
    await expect(history).toContainText('3 phiên bản');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      const richEditor = page.locator('app-chapter-rich-editor');
      expect(
        await richEditor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`author-editor-${width}.png`),
        fullPage: true,
      });
    }
  });
});
