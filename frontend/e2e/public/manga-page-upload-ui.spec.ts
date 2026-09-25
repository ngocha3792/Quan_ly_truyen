import { expect, test } from '@playwright/test';
import { EDITOR_URL, mockAuthorEditorApi } from '../support/author-studio-editor-api';

/** PNG 1x1 hợp lệ, đủ để trình duyệt giải mã và nén như ảnh thật. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function image(name: string) {
  return { name, mimeType: 'image/png', buffer: PNG };
}

test.describe('Manga page upload with controlled API responses', () => {
  test('attaches pages in the chosen order and shows them all without a reload', async ({
    page,
    context,
  }) => {
    // Ảnh đầu chậm nhất: tải song song thì trang sẽ gắn ngược thứ tự chọn.
    const api = await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'MANGA',
      uploadDelaysMs: [400, 200, 0],
    });

    await page.goto(EDITOR_URL);
    const uploader = page.locator('app-manga-page-uploader');
    await expect(uploader).toContainText('Trang truyện · 0 ảnh');

    await uploader
      .locator('input[type="file"]')
      .setInputFiles([image('trang-1.png'), image('trang-2.png'), image('trang-3.png')]);

    await expect(uploader).toContainText('Trang truyện · 3 ảnh');

    expect(api.mangaUploads).toEqual(['trang-1.png', 'trang-2.png', 'trang-3.png']);
    expect(api.mangaAttached).toEqual(['media-1', 'media-2', 'media-3']);

    // Không F5: cả ba trang phải hiện ngay, đúng thứ tự đọc.
    const thumbnails = uploader.locator('.manga-page-card img');
    await expect(thumbnails).toHaveCount(3);
    await expect(uploader.locator('.manga-page-index')).toHaveText(['1', '2', '3']);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('submits a chapter that has pages but no text', async ({ page, context }) => {
    const api = await mockAuthorEditorApi(context, {
      storyStatus: 'DRAFT',
      storyFormat: 'MANGA',
    });

    await page.goto(EDITOR_URL);
    const uploader = page.locator('app-manga-page-uploader');
    await uploader.locator('input[type="file"]').setInputFiles([image('trang-1.png')]);
    await expect(uploader).toContainText('Trang truyện · 1 ảnh');

    await page.getByRole('button', { name: 'Lưu và gửi duyệt', exact: true }).click();

    await expect(page.getByRole('region', { name: 'Quy trình duyệt chương' })).toContainText(
      'Đang chờ duyệt, nội dung được khóa.',
    );
    expect(api.chapter().status).toBe('IN_REVIEW');
  });
});
