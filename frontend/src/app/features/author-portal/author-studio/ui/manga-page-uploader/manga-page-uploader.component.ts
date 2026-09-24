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
  /** Thứ tự mới đầy đủ sau khi kéo thả. */
  readonly reorderRequested = output<readonly string[]>();

  protected readonly fileError = signal<string | null>(null);
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dropTargetId = signal<string | null>(null);
  protected readonly fileDropActive = signal(false);

  protected selectFiles(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    this.acceptFiles(files);
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

  /* Kéo thả để sắp xếp ------------------------------------------------- */

  protected canReorder(): boolean {
    return !this.disabled() && !this.reordering() && this.pages().length > 1;
  }

  protected dragStart(event: DragEvent, mediaAssetId: string): void {
    if (!this.canReorder()) {
      event.preventDefault();
      return;
    }
    this.draggingId.set(mediaAssetId);
    event.dataTransfer?.setData('text/plain', mediaAssetId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOverPage(event: DragEvent, mediaAssetId: string): void {
    if (!this.draggingId() || this.draggingId() === mediaAssetId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTargetId.set(mediaAssetId);
  }

  protected dropOnPage(event: DragEvent, mediaAssetId: string): void {
    const sourceId = this.draggingId();
    this.dragEnd();
    if (!sourceId || sourceId === mediaAssetId) return;
    event.preventDefault();

    const order = this.pages().map((page) => page.mediaAssetId);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(mediaAssetId);
    if (from < 0 || to < 0) return;

    order.splice(to, 0, ...order.splice(from, 1));
    this.reorderRequested.emit(order);
  }

  protected dragEnd(): void {
    this.draggingId.set(null);
    this.dropTargetId.set(null);
  }

  /* Kéo file từ ngoài vào để tải lên ------------------------------------ */

  private carriesFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  protected dragOverDropZone(event: DragEvent): void {
    if (this.draggingId() || !this.carriesFiles(event) || this.disabled() || this.uploading()) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.fileDropActive.set(true);
  }

  protected dragLeaveDropZone(event: DragEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.fileDropActive.set(false);
  }

  protected dropFiles(event: DragEvent): void {
    if (this.draggingId() || !this.carriesFiles(event) || this.disabled() || this.uploading()) {
      return;
    }
    event.preventDefault();
    this.fileDropActive.set(false);
    this.acceptFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  private acceptFiles(files: readonly File[]): void {
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
}
