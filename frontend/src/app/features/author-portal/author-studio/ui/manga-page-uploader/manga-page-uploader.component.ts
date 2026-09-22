import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { AuthorChapterEditorStore } from '../../data-access/author-chapter-editor.store';
import { validateChapterImage } from '../../domain/chapter-image-validation';

@Component({
  selector: 'app-manga-page-uploader',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './manga-page-uploader.component.html',
  styleUrl: './manga-page-uploader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MangaPageUploaderComponent {
  readonly storyId = input.required<string>();
  readonly chapterId = input.required<string>();
  readonly disabled = input(false);

  protected readonly store = inject(AuthorChapterEditorStore);
  protected readonly fileError = signal<string | null>(null);

  protected async selectFiles(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (files.length === 0) return;

    for (const file of files) {
      const message = validateChapterImage(file);
      if (message) {
        this.fileError.set(message);
        continue;
      }

      this.fileError.set(null);
      await new Promise<void>((resolve) => {
        this.store.uploadPage(this.storyId(), this.chapterId(), file).subscribe({
          next: () => resolve(),
          error: () => resolve(),
        });
      });
    }
  }

  protected moveUp(mediaAssetId: string): void {
    this.store.movePage(this.storyId(), this.chapterId(), mediaAssetId, -1);
  }

  protected moveDown(mediaAssetId: string): void {
    this.store.movePage(this.storyId(), this.chapterId(), mediaAssetId, 1);
  }

  protected remove(mediaAssetId: string): void {
    if (!window.confirm('Xóa trang này khỏi chương?')) return;
    this.store.removePage(this.storyId(), this.chapterId(), mediaAssetId);
  }
}
