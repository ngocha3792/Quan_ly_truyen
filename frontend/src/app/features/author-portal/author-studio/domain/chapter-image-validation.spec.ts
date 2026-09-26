import { validateChapterImage, validateCoverImage } from './chapter-image-validation';

function imageFile(name: string, type: string, sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('chapter-image-validation', () => {
  it('nhận đúng ba định dạng được hỗ trợ', () => {
    for (const [name, type] of [
      ['trang.jpg', 'image/jpeg'],
      ['trang.jpeg', 'image/jpeg'],
      ['trang.png', 'image/png'],
      ['trang.webp', 'image/webp'],
    ] as const) {
      expect(validateChapterImage(imageFile(name, type))).toBeNull();
      expect(validateCoverImage(imageFile(name, type))).toBeNull();
    }
  });

  it('tin vào đuôi file khi trình duyệt không cho biết MIME type', () => {
    expect(validateChapterImage(imageFile('trang.png', ''))).toBeNull();
  });

  it('loại ảnh sai định dạng, cả theo đuôi lẫn theo MIME type', () => {
    expect(validateChapterImage(imageFile('trang.gif', 'image/gif'))).toContain(
      'JPG, PNG hoặc WebP',
    );
    // Đuôi đúng nhưng MIME sai: không tin đuôi một cách mù quáng.
    expect(validateChapterImage(imageFile('trang.png', 'image/gif'))).toContain(
      'JPG, PNG hoặc WebP',
    );
    expect(validateChapterImage(imageFile('khong-co-duoi', 'image/png'))).toContain(
      'JPG, PNG hoặc WebP',
    );
  });

  it('nói rõ là quá nặng chứ không nói sai định dạng', () => {
    const heavy = imageFile('trang.png', 'image/png', 10 * 1024 * 1024 + 1);

    // Ảnh đúng định dạng nhưng quá nặng: báo sai là để người dùng sửa sai chỗ.
    expect(validateChapterImage(heavy)).toContain('10 MB');
    expect(validateChapterImage(heavy)).not.toContain('JPG');
    expect(validateCoverImage(heavy)).toContain('10 MB');
  });

  it('nhận đúng 10 MB, chỉ chặn khi vượt', () => {
    expect(validateChapterImage(imageFile('trang.png', 'image/png', 10 * 1024 * 1024))).toBeNull();
  });

  it('ảnh bìa có câu thông báo riêng cho lỗi định dạng', () => {
    const message = validateCoverImage(imageFile('bia.gif', 'image/gif'));

    expect(message).toContain('Ảnh bìa');
  });
});
