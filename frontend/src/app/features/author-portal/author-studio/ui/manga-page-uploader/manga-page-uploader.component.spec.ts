import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MangaPageUploaderComponent } from './manga-page-uploader.component';

function imageFile(name: string, type = 'image/png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

/**
 * jsdom không dựng được `DataTransfer`, nên gắn tay `clipboardData` — đây đúng
 * là hình dạng mà trình duyệt đưa cho trình nghe.
 */
function dispatchPaste(files: readonly File[], target: EventTarget = document): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  target.dispatchEvent(event);
  return event;
}

describe('MangaPageUploaderComponent dán ảnh', () => {
  let fixture: ComponentFixture<MangaPageUploaderComponent>;
  let emitted: (readonly File[])[];

  beforeEach(() => {
    fixture = TestBed.createComponent(MangaPageUploaderComponent);
    fixture.componentRef.setInput('pages', []);
    emitted = [];
    fixture.componentInstance.filesSelected.subscribe((files) => emitted.push(files));
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function errorText(): string | null {
    return (
      (fixture.nativeElement as HTMLElement)
        .querySelector('.manga-pages-error')
        ?.textContent?.trim() ?? null
    );
  }

  it('thêm trang từ ảnh chụp màn hình dán vào', () => {
    const event = dispatchPaste([imageFile('')]);
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toHaveLength(1);
    // Blob không tên phải được đặt tên, nếu không validateChapterImage loại ngay.
    expect(emitted[0][0].name).toMatch(/^anh-dan-\d{8}-\d{6}\.png$/);
    expect(event.defaultPrevented).toBe(true);
  });

  it('nhận nhiều ảnh trong một lần dán', () => {
    dispatchPaste([imageFile(''), imageFile('')]);

    expect(emitted[0]).toHaveLength(2);
  });

  it('để yên thao tác dán chữ', () => {
    const event = dispatchPaste([]);

    expect(emitted).toEqual([]);
    // preventDefault ở đây là nuốt mất thao tác dán chữ của người dùng.
    expect(event.defaultPrevented).toBe(false);
  });

  it('không cướp phím dán khi con trỏ đang ở ô nhập liệu', () => {
    const input = document.createElement('input');
    document.body.append(input);

    try {
      const event = dispatchPaste([imageFile('')], input);

      expect(emitted).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    } finally {
      input.remove();
    }
  });

  it('báo lý do khi ảnh dán vào sai kiểu', () => {
    dispatchPaste([imageFile('', 'image/tiff')]);
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(errorText()).toContain('JPG, PNG hay WebP');
  });

  it('không dán khi đang tải ảnh khác hoặc bị khoá', () => {
    for (const [name, value] of [
      ['uploading', true],
      ['disabled', true],
    ] as const) {
      fixture.componentRef.setInput(name, value);
      fixture.detectChanges();

      dispatchPaste([imageFile('')]);
      expect(emitted).toEqual([]);

      fixture.componentRef.setInput(name, false);
      fixture.detectChanges();
    }
  });

  it('xoá lỗi cũ khi lần dán sau thành công', () => {
    dispatchPaste([imageFile('', 'image/tiff')]);
    fixture.detectChanges();
    expect(errorText()).not.toBeNull();

    dispatchPaste([imageFile('')]);
    fixture.detectChanges();

    expect(errorText()).toBeNull();
    expect(emitted).toHaveLength(1);
  });

  it('ngừng nghe sau khi rời trang', () => {
    fixture.destroy();

    dispatchPaste([imageFile('')]);

    expect(emitted).toEqual([]);
  });
});
