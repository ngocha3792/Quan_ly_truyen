import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
} from '../../domain/author-application.models';
import { AuthorApplicationFileUploadComponent } from '../author-application-file-upload/author-application-file-upload.component';

@Component({
  selector: 'app-author-application-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthorApplicationFileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './author-application-form.component.html',
  styleUrl: './author-application-form.component.scss',
})
export class AuthorApplicationFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);
  private selectedFile: File | null = null;

  @Input() draft: AuthorApplicationDraft | null = null;
  @Input({ required: true }) config!: AuthorApplicationConfig;
  @Input() submitting = false;
  @Input() draftSaving = false;
  @Input() successMessage = '';
  @Input() errorMessage = '';
  @Input({
    required: true,
  })
  emailVerified = false;
  @Output() readonly submitApplication = new EventEmitter<AuthorApplicationPayload>();
  @Output() readonly saveDraft = new EventEmitter<AuthorApplicationDraft>();

  protected fileError = '';
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

  protected hasError(
    controlName: keyof typeof this.form.controls,

    errorName: string,
  ): boolean {
    const control = this.form.controls[controlName];

    return control.touched && control.hasError(errorName);
  }

  protected handleFileChange(file: File | null): void {
    this.selectedFile = file;

    this.fileError = '';
  }

  protected handleSaveDraft(): void {
    /*
     * UI button đã disabled,
     * nhưng handler vẫn tự bảo vệ.
     */
    if (!this.emailVerified) {
      return;
    }

    this.saveDraft.emit(this.buildDraft());
  }

  protected handleSubmit(): void {
    /*
     * Frontend defense-in-depth.
     *
     * Backend VerifiedEmailGuard vẫn là
     * source of truth.
     */
    if (!this.emailVerified) {
      return;
    }

    this.form.markAllAsTouched();

    if (!this.selectedFile) {
      this.fileError = 'Vui lòng đính kèm mẫu chương truyện.';
    }

    if (this.form.invalid || !this.selectedFile) {
      return;
    }

    this.submitApplication.emit({
      ...this.buildDraft(),

      sampleFile: this.selectedFile,
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

      sampleFileName: this.selectedFile?.name,
    };
  }
}
