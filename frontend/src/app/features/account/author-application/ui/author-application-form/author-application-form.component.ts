import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
} from '../../domain/author-application.models';

@Component({
  selector: 'app-author-application-form',
  standalone: true,

  imports: [ReactiveFormsModule, RouterLink],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-application-form.component.html',

  styleUrl: './author-application-form.component.scss',
})
export class AuthorApplicationFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input()
  draft: AuthorApplicationDraft | null = null;

  @Input({ required: true })
  config!: AuthorApplicationConfig;

  @Input()
  submitting = false;

  @Input()
  draftSaving = false;

  @Input()
  successMessage = '';

  @Input()
  errorMessage = '';

  @Output()
  readonly submitApplication = new EventEmitter<AuthorApplicationPayload>();

  @Output()
  readonly saveDraft = new EventEmitter<AuthorApplicationDraft>();

  protected readonly dragging = signal(false);

  protected readonly selectedFile = signal<File | null>(null);

  protected readonly fileError = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    penName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],

    fullName: ['', [Validators.required, Validators.maxLength(80)]],

    email: ['', [Validators.required, Validators.email]],

    phone: ['', [Validators.required, Validators.pattern(/^(?:\+84|0)(?:\d[\s.-]?){8,10}\d$/)]],

    portfolioUrl: ['', [Validators.pattern(/^(https?:\/\/.+)?$/)]],

    primaryGenre: ['', Validators.required],

    experience: ['', Validators.required],

    introduction: ['', Validators.required],

    firstWorkSynopsis: ['', Validators.required],

    acceptedTerms: [false, Validators.requiredTrue],
  });

  protected get acceptedFileTypes(): string {
    return this.config.acceptedFileExtensions.join(',');
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string): boolean {
    const control = this.form.controls[controlName];

    return control.touched && control.hasError(errorName);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['draft'] || !this.draft) {
      return;
    }

    this.form.patchValue(
      {
        penName: this.draft.penName,

        fullName: this.draft.fullName,

        email: this.draft.email,

        phone: this.draft.phone,

        portfolioUrl: this.draft.portfolioUrl,

        primaryGenre: this.draft.primaryGenre,

        experience: this.draft.experience,

        introduction: this.draft.introduction,

        firstWorkSynopsis: this.draft.firstWorkSynopsis,

        acceptedTerms: this.draft.acceptedTerms,
      },

      {
        emitEvent: false,
      },
    );

    this.form.markAsPristine();
  }

  protected handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;

    const file = input.files?.[0] ?? null;

    this.validateAndSelectFile(file);

    input.value = '';
  }

  protected handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragging.set(true);
  }

  protected handleDragLeave(): void {
    this.dragging.set(false);
  }

  protected handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragging.set(false);

    const file = event.dataTransfer?.files?.[0] ?? null;

    this.validateAndSelectFile(file);
  }

  protected removeFile(event: Event): void {
    event.stopPropagation();

    this.selectedFile.set(null);
    this.fileError.set('');
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1_048_576) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  protected handleSaveDraft(): void {
    this.saveDraft.emit(this.buildDraft());
  }

  protected handleSubmit(): void {
    this.form.markAllAsTouched();

    const file = this.selectedFile();

    if (!file) {
      this.fileError.set('Vui lòng đính kèm mẫu chương truyện.');
    }

    if (this.form.invalid || !file) {
      return;
    }

    this.submitApplication.emit({
      ...this.buildDraft(),
      sampleFile: file,
    });
  }

  private buildDraft(): AuthorApplicationDraft {
    const value = this.form.getRawValue();

    return {
      penName: value.penName.trim(),
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim(),

      portfolioUrl: value.portfolioUrl.trim(),

      primaryGenre: value.primaryGenre,

      experience: value.experience,

      introduction: value.introduction.trim(),

      firstWorkSynopsis: value.firstWorkSynopsis.trim(),

      acceptedTerms: value.acceptedTerms,

      sampleFileName: this.selectedFile()?.name,
    };
  }

  private validateAndSelectFile(file: File | null): void {
    this.fileError.set('');

    if (!file) {
      return;
    }

    const extension = `.${file.name.split('.').pop()?.toLocaleLowerCase()}`;

    const allowed = this.config.acceptedFileExtensions.map((item) => item.toLocaleLowerCase());

    if (!allowed.includes(extension)) {
      this.selectedFile.set(null);

      this.fileError.set(
        `File không hợp lệ. Chỉ chấp nhận ${this.config.acceptedFileExtensions.join(', ')}.`,
      );

      return;
    }

    const maximumBytes = this.config.maximumFileSizeMb * 1024 * 1024;

    if (file.size > maximumBytes) {
      this.selectedFile.set(null);

      this.fileError.set(`Dung lượng file không được vượt quá ${this.config.maximumFileSizeMb}MB.`);

      return;
    }

    this.selectedFile.set(file);
  }
}
