import { Slice } from '@tiptap/pm/model';

import { TiptapEditorService } from './tiptap-editor.service';

describe('TiptapEditorService', () => {
  let service: TiptapEditorService;
  let host: HTMLElement;
  let onChange = vi.fn<(value: string) => void>();

  beforeEach(() => {
    service = new TiptapEditorService();
    host = document.createElement('div');
    document.body.appendChild(host);
    onChange = vi.fn<(value: string) => void>();
  });

  afterEach(() => {
    service.destroy();
    host.remove();
  });

  it('hydrates Markdown without rewriting or marking unchanged content as dirty', () => {
    const original = '# Chương một\n\nĐoạn **in đậm** và _in nghiêng_.\n\n\n';
    service.create(host, original, false, onChange);
    expect(host.querySelector('h1')?.textContent).toBe('Chương một');
    expect(host.querySelector('strong')?.textContent).toBe('in đậm');
    expect(host.querySelector('em')?.textContent).toBe('in nghiêng');
    expect(service.getContent()).toBe(original);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps headings, nested lists, code, quotes, safe links and inline images through an edit', () => {
    service.create(
      host,
      [
        '## Tiêu đề',
        'Đọc **đậm** và *nghiêng* với [liên kết](https://example.com/chapter?q=1 "Nguồn").',
        '- Mục một\n  - Mục con\n- Mục hai',
        '> Trích dẫn',
        '```ts\nconst test = "<script>";\n```',
        'Trước ![Ảnh](https://example.com/image.webp) sau.',
        '---',
      ].join('\n\n'),
      false,
      onChange,
    );
    const before = service.editor!.getJSON();
    service.editor!.commands.insertContentAt(service.editor!.state.doc.content.size, {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Đoạn thêm.' }],
    });
    const edited = service.getContent();
    expect(edited).toContain('## Tiêu đề');
    expect(edited).toContain('![Ảnh](https://example.com/image.webp)');
    expect(edited).toContain('https://example.com/chapter?q=1');
    expect(edited).toContain('const test = "<script>";');
    expect(host.querySelector('script')).toBeNull();
    service.setContent(`${edited}\n`);
    const after = service.editor!.getJSON();
    expect(after.content?.slice(0, before.content?.length)).toEqual(before.content);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not reset the selection or undo history when the parent echoes an emitted value', () => {
    service.create(host, 'Xin chào', false, onChange);
    service.editor!.commands.insertContentAt(9, '!');
    const selection = service.editor!.state.selection;
    service.setContent(service.getContent());
    expect(service.editor!.state.selection.eq(selection)).toBe(true);
    expect(service.editor!.commands.undo()).toBe(true);
    expect(service.editor!.getText()).toBe('Xin chào');
  });

  it('accepts remote/restored content without emitting another save', () => {
    service.create(host, 'Bản cũ', false, onChange);
    service.setContent('## Bản khôi phục\n\nBa từ mới');
    expect(service.editor!.getText()).toContain('Bản khôi phục');
    expect(service.statistics().words).toBe(6);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves existing Markdown tables and task completion when editing surrounding prose', () => {
    service.create(
      host,
      '| Tên | Giá trị |\n| --- | --- |\n| Một | Hai |\n\n- [x] Đã xong\n- [ ] Còn lại',
      false,
      onChange,
    );
    expect(host.querySelector('table')?.textContent).toContain('Một');
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    service.editor!.commands.insertContentAt(service.editor!.state.doc.content.size, {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Thêm đoạn' }],
    });
    expect(service.getContent()).toMatch(/\| Một \| Hai +\|/u);
    expect(service.getContent()).toContain('- [x] Đã xong');
    expect(service.getContent()).toContain('- [ ] Còn lại');
  });

  it('prevents editing in read-only mode and never renders unsafe image or link targets', () => {
    service.create(
      host,
      '[Link](javascript:alert%281%29) ![Ảnh](javascript:alert%281%29)',
      true,
      onChange,
    );
    expect(host.querySelector('[contenteditable]')?.getAttribute('contenteditable')).toBe('false');
    expect(host.querySelector('a')?.getAttribute('href')).not.toContain('javascript:');
    expect(host.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(service.insertImage('https://example.com/a.webp', 'Ảnh')).toBe(false);
    service.setDisabled(false);
    expect(service.insertImage('javascript:alert(1)', 'Ảnh')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('escapes image alt text so filenames cannot inject extra Markdown', () => {
    service.create(host, 'Ảnh minh họa', false, onChange);
    service.editor!.commands.setImage({ src: 'https://example.com/a.webp', alt: 'Ảnh [1]' });
    expect(service.getContent()).toContain('![Ảnh \\[1\\]](https://example.com/a.webp)');
    service.setContent(`${service.getContent()}\n`);
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('Ảnh [1]');
  });

  describe('dán ảnh vào vùng soạn thảo', () => {
    function imageFile(type = 'image/png'): File {
      return new File([new Uint8Array([1, 2, 3])], '', { type });
    }

    /**
     * Gọi thẳng `handlePaste` mà tiptap đã đăng ký: jsdom không dựng được
     * `DataTransfer` nên không dán thật qua DOM được, nhưng đây đúng là hàm
     * ProseMirror gọi và đúng hình dạng sự kiện nó truyền vào.
     */
    function paste(files: readonly File[]): boolean {
      const event = new Event('paste') as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', { value: { files } });
      const handler = service.editor!.view.props.handlePaste!;
      return handler(service.editor!.view, event, Slice.empty) ?? false;
    }

    it('chuyển ảnh dán vào cho nơi gọi và nuốt sự kiện', () => {
      const onPaste = vi.fn<(files: readonly File[], error: string | null) => void>();
      service.create(host, 'Nội dung', false, onChange, onPaste);

      // Nuốt sự kiện mới chặn được tiptap nhúng base64 vào nội dung chương.
      expect(paste([imageFile()])).toBe(true);
      expect(onPaste).toHaveBeenCalledTimes(1);
      const [files, error] = onPaste.mock.calls[0];
      expect(files).toHaveLength(1);
      expect(files[0].name).toMatch(/^anh-dan-\d{8}-\d{6}\.png$/);
      expect(error).toBeNull();
    });

    it('để tiptap tự xử lý khi dán chữ', () => {
      const onPaste = vi.fn<(files: readonly File[], error: string | null) => void>();
      service.create(host, 'Nội dung', false, onChange, onPaste);

      expect(paste([])).toBe(false);
      expect(onPaste).not.toHaveBeenCalled();
    });

    it('báo lý do khi kiểu ảnh không dán được', () => {
      const onPaste = vi.fn<(files: readonly File[], error: string | null) => void>();
      service.create(host, 'Nội dung', false, onChange, onPaste);

      expect(paste([imageFile('image/tiff')])).toBe(true);
      const [files, error] = onPaste.mock.calls[0];
      expect(files).toEqual([]);
      expect(error).toContain('JPG, PNG hay WebP');
    });

    it('không nuốt sự kiện khi nơi gọi không nhận ảnh dán', () => {
      service.create(host, 'Nội dung', false, onChange);

      // Không có người nhận thì thà để tiptap xử lý còn hơn nuốt im lặng.
      expect(paste([imageFile()])).toBe(false);
    });
  });
});
