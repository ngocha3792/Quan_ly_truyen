import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';

import { AuthorApplicationConfig } from '../../domain/author-application.models';

@Component({
  selector: 'app-author-application-file-upload',
  standalone: true,
  templateUrl: './author-application-file-upload.component.html',
  styleUrl: './author-application-file-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorApplicationFileUploadComponent {
  @Input({ required: true }) config!: AuthorApplicationConfig;
  @Input() requiredError = '';
  @Output() readonly fileChange = new EventEmitter<File | null>();

  protected readonly dragging = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly validationError = signal('');

  protected get acceptedFileTypes(): string {
    return this.config.acceptedFileExtensions.join(',');
  }

  protected selectFromInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.validate(input.files?.[0] ?? null);
    input.value = '';
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(true);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
    this.validate(event.dataTransfer?.files?.[0] ?? null);
  }

  protected remove(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
    this.validationError.set('');
    this.fileChange.emit(null);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  private validate(file: File | null): void {
    this.validationError.set('');
    if (!file) return;

    const extension = `.${file.name.split('.').pop()?.toLocaleLowerCase()}`;
    const allowed = this.config.acceptedFileExtensions.map((item) => item.toLocaleLowerCase());
    if (!allowed.includes(extension)) {
      this.reject(
        `File không hợp lệ. Chỉ chấp nhận ${this.config.acceptedFileExtensions.join(', ')}.`,
      );
      return;
    }

    if (file.size > this.config.maximumFileSizeMb * 1024 * 1024) {
      this.reject(`Dung lượng file không được vượt quá ${this.config.maximumFileSizeMb}MB.`);
      return;
    }

    this.selectedFile.set(file);
    this.fileChange.emit(file);
  }

  private reject(message: string): void {
    this.selectedFile.set(null);
    this.validationError.set(message);
    this.fileChange.emit(null);
  }
}
