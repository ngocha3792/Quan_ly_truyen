import { expect, Page, test } from '@playwright/test';
import { EDITOR_URL, mockAuthorEditorApi, STORY_ID } from '../support/author-studio-editor-api';

/** PNG 1x1 hợp lệ, đủ để trình duyệt giải mã và nén như ảnh thật. */
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * Dán ảnh như người dùng thật: dựng `DataTransfer` trong trình duyệt rồi phát
 * `ClipboardEvent`. Unit test phải gắn tay `clipboardData` vì jsdom không có
 * `DataTransfer`, nên chỉ ở đây mới kiểm được đúng đường trình duyệt đi.
 *
 * @param fileName Để rỗng để giả đúng blob không tên của Snipping Tool.
 */
async function pasteImage(page: Page, options: { fileName?: string; mimeType?: string } = {}) {
  await page.evaluate(
    async ({ dataUrl, fileName, mimeType }) => {
      const blob = await (await fetch(dataUrl)).blob();
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], fileName, { type: mimeType }));
      document.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    {
      dataUrl: PNG_DATA_URL,
      fileName: options.fileName ?? '',
      mimeType: options.mimeType ?? 'image/png',
    },
  );
}

test.describe('Dán ảnh bằng Ctrl+V', () => {
  test('dán ảnh chụp màn hình vào chương truyện tranh thành một trang mới', async ({
    page,
    context,
  }) => {
    const api = await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'MANGA',
    });

    await page.goto(EDITOR_URL);
    const uploader = page.locator('app-manga-page-uploader');
    await expect(uploader).toContainText('Trang truyện · 0 ảnh');

    await pasteImage(page);

    await expect(uploader).toContainText('Trang truyện · 1 ảnh');
    await expect(uploader.locator('.manga-page-card img')).toHaveCount(1);

    /*
     * Blob dán vào không có tên. Nếu không được đặt tên lại thì
     * validateChapterImage loại ngay từ đầu và chẳng có gì lên tới đây.
     */
    expect(api.mangaUploads).toHaveLength(1);
    expect(api.mangaUploads[0]).toMatch(/^anh-dan-\d{8}-\d{6}\.png$/);
  });

  test('dán nhiều lần thì cộng dồn trang, không ghi đè', async ({ page, context }) => {
    const api = await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'MANGA',
    });

    await page.goto(EDITOR_URL);
    const uploader = page.locator('app-manga-page-uploader');
    await expect(uploader).toContainText('Trang truyện · 0 ảnh');

    await pasteImage(page);
    await expect(uploader).toContainText('Trang truyện · 1 ảnh');
    await pasteImage(page);
    await expect(uploader).toContainText('Trang truyện · 2 ảnh');

    expect(api.mangaUploads).toHaveLength(2);
  });

  test('nói rõ lý do khi ảnh dán vào sai định dạng', async ({ page, context }) => {
    await mockAuthorEditorApi(context, { storyStatus: 'DRAFT', storyFormat: 'MANGA' });

    await page.goto(EDITOR_URL);
    const uploader = page.locator('app-manga-page-uploader');
    await expect(uploader).toContainText('Trang truyện · 0 ảnh');

    // Ảnh chụp màn hình trên macOS hay ra TIFF.
    await pasteImage(page, { mimeType: 'image/tiff' });

    await expect(uploader.locator('.manga-pages-error')).toContainText('JPG, PNG hay WebP');
    await expect(uploader).toContainText('Trang truyện · 0 ảnh');
  });

  test('không cướp phím dán khi con trỏ đang ở ô tiêu đề', async ({ page, context }) => {
    const api = await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'MANGA',
    });

    await page.goto(EDITOR_URL);
    await expect(page.locator('app-manga-page-uploader')).toContainText('Trang truyện · 0 ảnh');
    const title = page.getByLabel(/tiêu đề/i).first();
    await title.click();

    await page.evaluate(async (dataUrl) => {
      const blob = await (await fetch(dataUrl)).blob();
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], '', { type: 'image/png' }));
      document.activeElement?.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, PNG_DATA_URL);

    await expect(page.locator('app-manga-page-uploader')).toContainText('Trang truyện · 0 ảnh');
    expect(api.mangaUploads).toEqual([]);
  });

  test('dán ảnh bìa vào trang sửa truyện hiện ngay bản xem trước', async ({ page, context }) => {
    await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'NOVEL',
      // Trang này có route guard riêng, khác trình soạn chương.
      extraPermissions: ['story.update.own'],
    });

    await page.goto(`/author-studio/truyen/${STORY_ID}`);
    const coverBox = page.locator('.cover-box');
    await expect(coverBox).toContainText('Chưa có ảnh bìa');

    await pasteImage(page);

    // Xem trước dựng từ object URL cục bộ, chưa gọi mạng — ảnh bìa chỉ lên
    // máy chủ khi bấm Lưu.
    await expect(coverBox.locator('img')).toBeVisible();
    await expect(coverBox).not.toContainText('Chưa có ảnh bìa');
  });

  test('ảnh bìa dán sai định dạng thì báo lỗi và giữ nguyên ảnh cũ', async ({ page, context }) => {
    await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'NOVEL',
      extraPermissions: ['story.update.own'],
    });

    await page.goto(`/author-studio/truyen/${STORY_ID}`);
    const coverBox = page.locator('.cover-box');
    await expect(coverBox).toContainText('Chưa có ảnh bìa');

    await pasteImage(page, { mimeType: 'image/tiff' });

    await expect(page.locator('.notice[data-kind="error"]')).toContainText('JPG, PNG hay WebP');
    await expect(coverBox).toContainText('Chưa có ảnh bìa');
  });
});
