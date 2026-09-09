import { Injectable, signal } from '@angular/core';
import { Editor } from '@tiptap/core';

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

  create(
    element: HTMLElement,
    content: string,
    disabled: boolean,
    onChange: (value: string) => void,
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
