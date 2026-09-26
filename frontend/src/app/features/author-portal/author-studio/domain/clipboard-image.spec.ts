import {
  isTypingTarget,
  readPastedImages,
  UNSUPPORTED_PASTED_IMAGE_MESSAGE,
} from './clipboard-image';

const PASTED_AT = new Date(2026, 8, 26, 4, 30, 12);

function file(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('readPastedImages', () => {
  it('không đụng vào clipboard không có ảnh', () => {
    const result = readPastedImages([], PASTED_AT);

    // carriedImage sai thì nơi gọi sẽ nuốt mất thao tác dán chữ.
    expect(result.carriedImage).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('bỏ qua file đính kèm không phải ảnh', () => {
    const result = readPastedImages([file('ghi-chu.txt', 'text/plain')], PASTED_AT);

    expect(result.carriedImage).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('đặt tên mới cho ảnh chụp màn hình không có tên dùng được', () => {
    // Blob từ Snipping Tool: validateChapterImage sẽ từ chối vì không có đuôi.
    const result = readPastedImages([file('', 'image/png')], PASTED_AT);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('anh-dan-20260926-043012.png');
    expect(result.files[0].type).toBe('image/png');
    expect(result.error).toBeNull();
  });

  it('đặt tên mới cho blob có tên nhưng không có đuôi', () => {
    const result = readPastedImages([file('blob', 'image/png')], PASTED_AT);

    expect(result.files[0].name).toBe('anh-dan-20260926-043012.png');
  });

  it('dùng đuôi theo đúng MIME type chứ không mặc định png', () => {
    expect(readPastedImages([file('', 'image/jpeg')], PASTED_AT).files[0].name).toBe(
      'anh-dan-20260926-043012.jpg',
    );
    expect(readPastedImages([file('', 'image/webp')], PASTED_AT).files[0].name).toBe(
      'anh-dan-20260926-043012.webp',
    );
  });

  it('giữ nguyên tên thật khi copy ảnh từ File Explorer', () => {
    const result = readPastedImages([file('trang-01.png', 'image/png')], PASTED_AT);

    expect(result.files[0].name).toBe('trang-01.png');
  });

  it('đánh số để nhiều ảnh dán cùng lúc không trùng tên', () => {
    const result = readPastedImages(
      [file('', 'image/png'), file('', 'image/png'), file('', 'image/jpeg')],
      PASTED_AT,
    );

    expect(result.files.map((item) => item.name)).toEqual([
      'anh-dan-20260926-043012.png',
      'anh-dan-20260926-043012-2.png',
      'anh-dan-20260926-043012-3.jpg',
    ]);
  });

  it('báo lỗi rõ ràng cho ảnh TIFF thay vì im lặng bỏ qua', () => {
    // Chụp màn hình trên macOS hay ra TIFF; im lặng là để người dùng bấm
    // Ctrl+V mãi mà không hiểu vì sao không có gì xảy ra.
    const result = readPastedImages([file('', 'image/tiff')], PASTED_AT);

    expect(result.carriedImage).toBe(true);
    expect(result.files).toEqual([]);
    expect(result.error).toBe(UNSUPPORTED_PASTED_IMAGE_MESSAGE);
  });

  it('vẫn nhận ảnh dùng được khi dán lẫn ảnh không dùng được', () => {
    const result = readPastedImages([file('', 'image/gif'), file('', 'image/png')], PASTED_AT);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].type).toBe('image/png');
    expect(result.error).toBe(UNSUPPORTED_PASTED_IMAGE_MESSAGE);
  });

  it('không phân biệt hoa thường ở MIME type và đuôi file', () => {
    expect(readPastedImages([file('', 'IMAGE/PNG')], PASTED_AT).files[0].name).toBe(
      'anh-dan-20260926-043012.png',
    );
    expect(readPastedImages([file('TRANG.PNG', 'image/png')], PASTED_AT).files[0].name).toBe(
      'TRANG.PNG',
    );
  });

  it('giữ nội dung ảnh nguyên vẹn khi đổi tên', async () => {
    const original = file('', 'image/png');
    const result = readPastedImages([original], PASTED_AT);

    expect(result.files[0].size).toBe(original.size);
    expect(await result.files[0].arrayBuffer()).toEqual(await original.arrayBuffer());
  });
});

describe('isTypingTarget', () => {
  it('nhận ra ô nhập liệu để không nuốt mất thao tác dán chữ', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isTypingTarget(document.createElement(tag))).toBe(true);
    }
  });

  it('nhận ra vùng soạn thảo rich text, kể cả khi con trỏ ở thẻ con', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const paragraph = document.createElement('p');
    editable.append(paragraph);

    expect(isTypingTarget(editable)).toBe(true);
    // Con trỏ gần như luôn nằm ở thẻ con chứ không phải thẻ gốc.
    expect(isTypingTarget(paragraph)).toBe(true);
  });

  it('không coi contenteditable="false" là vùng soạn thảo', () => {
    const locked = document.createElement('div');
    locked.setAttribute('contenteditable', 'false');

    expect(isTypingTarget(locked)).toBe(false);
  });

  it('để yên cho phần còn lại của trang', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
