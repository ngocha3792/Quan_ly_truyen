import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';

import { isSafeEditorUrl } from './chapter-editor.extensions';
import { TiptapEditorService } from './tiptap-editor.service';

type EditorAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'codeBlock'
  | 'undo'
  | 'redo';

@Component({
  selector: 'app-chapter-rich-editor',
  standalone: true,
  templateUrl: './chapter-rich-editor.component.html',
  styleUrl: './chapter-rich-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [TiptapEditorService],
})
export class ChapterRichEditorComponent {
  readonly content = input('');
  readonly disabled = input(false);
  readonly contentChange = output<string>();
  protected readonly editorService = inject(TiptapEditorService);
  protected readonly ready = signal(false);
  protected readonly linkOpen = signal(false);
  protected readonly linkError = signal('');
  protected readonly actions: readonly { action: EditorAction; label: string; text: string }[] = [
    { action: 'bold', label: 'In đậm (Ctrl+B)', text: 'B' },
    { action: 'italic', label: 'In nghiêng (Ctrl+I)', text: 'I' },
    { action: 'strike', label: 'Gạch ngang', text: 'S' },
    { action: 'bulletList', label: 'Danh sách gạch đầu dòng', text: '• Danh sách' },
    { action: 'orderedList', label: 'Danh sách đánh số', text: '1. Danh sách' },
    { action: 'blockquote', label: 'Trích dẫn', text: '❞' },
    { action: 'codeBlock', label: 'Khối mã', text: '</>' },
    { action: 'undo', label: 'Hoàn tác (Ctrl+Z)', text: '↶' },
    { action: 'redo', label: 'Làm lại (Ctrl+Shift+Z)', text: '↷' },
  ];
  private readonly editorElement = viewChild.required<ElementRef<HTMLElement>>('editorElement');

  constructor() {
    afterNextRender({
      write: () => {
        this.editorService.create(
          this.editorElement().nativeElement,
          this.content(),
          this.disabled(),
          (value) => this.contentChange.emit(value),
        );
        this.ready.set(true);
      },
    });
    effect(() => {
      if (!this.ready()) return;
      this.editorService.setContent(this.content());
      this.editorService.setDisabled(this.disabled());
    });
    inject(DestroyRef).onDestroy(() => this.editorService.destroy());
  }

  insertImage(url: string, alt: string): boolean {
    return this.editorService.insertImage(url, alt);
  }

  protected isActive(name: string): boolean {
    this.editorService.revision();
    return this.editorService.editor?.isActive(name) ?? false;
  }

  protected heading(): string {
    this.editorService.revision();
    const editor = this.editorService.editor;
    return editor?.isActive('heading') ? String(editor.getAttributes('heading')['level']) : '0';
  }

  protected changeHeading(value: string): void {
    const chain = this.editorService.editor?.chain().focus();
    const level = Number(value);
    if (level >= 1 && level <= 6)
      chain?.setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    else chain?.setParagraph().run();
  }

  protected run(action: EditorAction): void {
    const chain = this.editorService.editor?.chain().focus();
    if (!chain || this.disabled()) return;
    switch (action) {
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'strike':
        chain.toggleStrike().run();
        break;
      case 'bulletList':
        chain.toggleBulletList().run();
        break;
      case 'orderedList':
        chain.toggleOrderedList().run();
        break;
      case 'blockquote':
        chain.toggleBlockquote().run();
        break;
      case 'codeBlock':
        chain.toggleCodeBlock().run();
        break;
      case 'undo':
        chain.undo().run();
        break;
      case 'redo':
        chain.redo().run();
        break;
    }
  }

  protected toggleLink(): void {
    this.linkOpen.update((value) => !value);
    this.linkError.set('');
  }

  protected setLink(value: string): void {
    const href = value.trim();
    if (!isSafeEditorUrl(href)) {
      this.linkError.set('Nhập liên kết HTTP, HTTPS hoặc email hợp lệ.');
      return;
    }
    this.editorService.editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
    this.linkOpen.set(false);
  }

  protected removeLink(): void {
    this.editorService.editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    this.linkOpen.set(false);
  }
}
