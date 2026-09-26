import { Injectable, signal } from '@angular/core';
import { Editor } from '@tiptap/core';

import { readPastedImages } from '../../domain/clipboard-image';
import { chapterEditorExtensions, isSafeEditorUrl } from './chapter-editor.extensions';

export interface ChapterEditorStatistics {
  readonly words: number;
  readonly characters: number;
}

@Injectable()
export class TiptapEditorService {
  readonly statistics = signal<ChapterEditorStatistics>({ words: 0, characters: 0 });
  readonly revision = signal(0);
  private instance: Editor | null = null;
  private markdown = '';

  get editor(): Editor | null {
    return this.instance;
  }

  /**
   * @param onImagePaste Nhận ảnh dán vào trong vùng soạn thảo. Bỏ trống thì ảnh
   *   dán vào bị bỏ qua, vì để tiptap tự xử lý sẽ nhúng thẳng base64 vào nội
   *   dung chương — phình bản nháp và không bao giờ lên được CDN.
   */
  create(
    element: HTMLElement,
    content: string,
    disabled: boolean,
    onChange: (value: string) => void,
    onImagePaste?: (files: readonly File[], error: string | null) => void,
  ): void {
    this.destroy();
    this.markdown = content;
    this.instance = new Editor({
      element,
      extensions: chapterEditorExtensions(),
      content,
      contentType: 'markdown',
      editable: !disabled,
      injectCSS: false,
      editorProps: {
        handlePaste: (_view, event) => this.handlePaste(event, onImagePaste),
        attributes: {
          role: 'textbox',
          class: 'chapter-rich-editor__document',
          'aria-label': 'Nội dung chương',
          'aria-multiline': 'true',
          'aria-readonly': String(disabled),
          spellcheck: 'true',
        },
      },
      onTransaction: () => this.revision.update((value) => value + 1),
      onUpdate: ({ editor }) => {
        this.markdown = editor.getMarkdown();
        this.updateStatistics();
        onChange(this.markdown);
      },
    });
    this.updateStatistics();
  }

  setContent(content: string): void {
    if (!this.instance || content === this.markdown) return;
    this.markdown = content;
    this.instance.commands.setContent(content, { contentType: 'markdown', emitUpdate: false });
    this.updateStatistics();
  }

  setDisabled(disabled: boolean): void {
    this.instance?.setEditable(!disabled, false);
    if (this.instance) this.instance.view.dom.setAttribute('aria-readonly', String(disabled));
  }

  getContent(): string {
    return this.markdown;
  }

  /**
   * @returns `true` khi đã nuốt sự kiện. Phải nuốt, nếu không tiptap chèn tiếp
   *   bản base64 của chính tấm ảnh đang được tải lên.
   */
  private handlePaste(
    event: ClipboardEvent,
    onImagePaste?: (files: readonly File[], error: string | null) => void,
  ): boolean {
    if (!onImagePaste) return false;

    const pasted = readPastedImages(Array.from(event.clipboardData?.files ?? []), new Date());

    // Dán chữ thì trả false để tiptap xử lý như thường.
    if (!pasted.carriedImage) return false;

    onImagePaste(pasted.files, pasted.error);
    return true;
  }

  insertImage(url: string, alt: string): boolean {
    if (!this.instance?.isEditable || !isSafeEditorUrl(url, true)) return false;
    return this.instance.chain().focus().setImage({ src: url, alt }).run();
  }

  destroy(): void {
    this.instance?.destroy();
    this.instance = null;
  }

  private updateStatistics(): void {
    const counter = this.instance?.storage.characterCount;
    this.statistics.set({ words: counter?.words() ?? 0, characters: counter?.characters() ?? 0 });
  }
}
