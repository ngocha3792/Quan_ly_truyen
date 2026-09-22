import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { AuthorChapterMediaPage } from '../../domain/author-story-management.models';
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
  readonly pages = input.required<readonly AuthorChapterMediaPage[]>();
  readonly uploading = input(false);
  readonly reordering = input(false);
  readonly disabled = input(false);

  readonly filesSelected = output<readonly File[]>();
  readonly moveUpRequested = output<string>();
  readonly moveDownRequested = output<string>();
  readonly removeRequested = output<string>();

  protected readonly fileError = signal<string | null>(null);

  protected selectFiles(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (files.length === 0) return;

    const validFiles: File[] = [];
    let message: string | null = null;

    for (const file of files) {
      const error = validateChapterImage(file);
      if (error) {
        message = error;
        continue;
      }
      validFiles.push(file);
    }

    this.fileError.set(message);
    if (validFiles.length > 0) this.filesSelected.emit(validFiles);
  }

  protected moveUp(mediaAssetId: string): void {
    this.moveUpRequested.emit(mediaAssetId);
  }

  protected moveDown(mediaAssetId: string): void {
    this.moveDownRequested.emit(mediaAssetId);
  }

  protected remove(mediaAssetId: string): void {
    if (!window.confirm('Xóa trang này khỏi chương?')) return;
    this.removeRequested.emit(mediaAssetId);
  }
}
