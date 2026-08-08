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

  template: `
    <section class="application-form-card">
      <header class="form-heading">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3"></circle>

          <path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"></path>

          <path d="M18 4h3"></path>
          <path d="M19.5 2.5v3"></path>
        </svg>

        <h2>Thông tin đăng ký</h2>
      </header>

      @if (successMessage) {
        <div class="form-message form-message--success">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"></circle>

            <path d="m8 12 2.5 2.5L16 9"></path>
          </svg>

          <span>{{ successMessage }}</span>
        </div>
      }

      @if (errorMessage) {
        <div class="form-message form-message--error">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"></circle>

            <path d="M12 7v6"></path>
            <path d="M12 17h.01"></path>
          </svg>

          <span>{{ errorMessage }}</span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="handleSubmit()">
        <div class="form-grid">
          <div class="form-field">
            <label for="author-pen-name">
              Bút danh
              <span>*</span>
            </label>

            <input
              id="author-pen-name"
              type="text"
              formControlName="penName"
              maxlength="40"
              autocomplete="nickname"
              placeholder="Nhập bút danh bạn muốn sử dụng"
            />

            @if (hasError('penName', 'required')) {
              <small class="field-error"> Vui lòng nhập bút danh. </small>
            }

            @if (hasError('penName', 'minlength')) {
              <small class="field-error"> Bút danh cần ít nhất 2 ký tự. </small>
            }
          </div>

          <div class="form-field">
            <label for="author-full-name">
              Họ và tên
              <span>*</span>
            </label>

            <input
              id="author-full-name"
              type="text"
              formControlName="fullName"
              maxlength="80"
              autocomplete="name"
              placeholder="Nhập họ và tên của bạn"
            />

            @if (hasError('fullName', 'required')) {
              <small class="field-error"> Vui lòng nhập họ và tên. </small>
            }
          </div>

          <div class="form-field">
            <label for="author-email">
              Email liên hệ
              <span>*</span>
            </label>

            <input
              id="author-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="example@email.com"
            />

            @if (hasError('email', 'required')) {
              <small class="field-error"> Vui lòng nhập email. </small>
            }

            @if (hasError('email', 'email')) {
              <small class="field-error"> Email không đúng định dạng. </small>
            }
          </div>

          <div class="form-field">
            <label for="author-phone">
              Số điện thoại
              <span>*</span>
            </label>

            <input
              id="author-phone"
              type="tel"
              formControlName="phone"
              autocomplete="tel"
              placeholder="Nhập số điện thoại liên hệ"
            />

            @if (hasError('phone', 'required')) {
              <small class="field-error"> Vui lòng nhập số điện thoại. </small>
            }

            @if (hasError('phone', 'pattern')) {
              <small class="field-error"> Số điện thoại không hợp lệ. </small>
            }
          </div>

          <div class="form-field">
            <label for="author-portfolio"> Liên kết Facebook / Portfolio </label>

            <input
              id="author-portfolio"
              type="url"
              formControlName="portfolioUrl"
              autocomplete="url"
              placeholder="https://facebook.com/tenban hoặc link portfolio"
            />

            @if (hasError('portfolioUrl', 'pattern')) {
              <small class="field-error">
                Đường dẫn phải bắt đầu bằng http:// hoặc https://.
              </small>
            }
          </div>

          <div class="form-field">
            <label for="author-genre">
              Thể loại sáng tác chính
              <span>*</span>
            </label>

            <div class="select-wrap">
              <select id="author-genre" formControlName="primaryGenre">
                <option value="">Chọn thể loại chính</option>

                @for (option of config.genreOptions; track option.value) {
                  <option [value]="option.value">
                    {{ option.label }}
                  </option>
                }
              </select>

              <svg viewBox="0 0 24 24">
                <path d="m8 10 4 4 4-4"></path>
              </svg>
            </div>

            @if (hasError('primaryGenre', 'required')) {
              <small class="field-error"> Vui lòng chọn thể loại. </small>
            }
          </div>

          <div class="form-field">
            <label for="author-experience">
              Kinh nghiệm viết
              <span>*</span>
            </label>

            <div class="select-wrap">
              <select id="author-experience" formControlName="experience">
                <option value="">Chọn mức kinh nghiệm</option>

                @for (option of config.experienceOptions; track option.value) {
                  <option [value]="option.value">
                    {{ option.label }}
                  </option>
                }
              </select>

              <svg viewBox="0 0 24 24">
                <path d="m8 10 4 4 4-4"></path>
              </svg>
            </div>

            @if (hasError('experience', 'required')) {
              <small class="field-error"> Vui lòng chọn kinh nghiệm. </small>
            }
          </div>
        </div>

        <div class="form-field form-field--full">
          <label for="author-introduction">
            Giới thiệu bản thân
            <span>*</span>
          </label>

          <textarea
            id="author-introduction"
            rows="4"
            formControlName="introduction"
            [maxlength]="config.introductionMaximumLength"
            placeholder="Giới thiệu ngắn gọn về bản thân, sở thích viết và hành trình sáng tác của bạn..."
          ></textarea>

          <span class="character-count">
            {{ form.controls.introduction.value.length }}
            /
            {{ config.introductionMaximumLength }}
          </span>

          @if (hasError('introduction', 'required')) {
            <small class="field-error"> Vui lòng giới thiệu bản thân. </small>
          }
        </div>

        <div class="form-field form-field--full">
          <label for="author-synopsis">
            Ý tưởng hoặc tóm tắt tác phẩm đầu tay
            <span>*</span>
          </label>

          <textarea
            id="author-synopsis"
            rows="5"
            formControlName="firstWorkSynopsis"
            [maxlength]="config.synopsisMaximumLength"
            placeholder="Mô tả ý tưởng, nội dung hoặc tóm tắt ngắn gọn tác phẩm đầu tay bạn muốn đăng tải..."
          ></textarea>

          <span class="character-count">
            {{ form.controls.firstWorkSynopsis.value.length }}
            /
            {{ config.synopsisMaximumLength }}
          </span>

          @if (hasError('firstWorkSynopsis', 'required')) {
            <small class="field-error"> Vui lòng nhập ý tưởng hoặc tóm tắt tác phẩm. </small>
          }
        </div>

        <div class="form-field form-field--full">
          <label>
            Mẫu chương truyện
            <span>*</span>
          </label>

          <div
            class="upload-zone"
            [class.upload-zone--dragging]="dragging()"
            [class.upload-zone--selected]="selectedFile()"
            tabindex="0"
            role="button"
            (click)="fileInput.click()"
            (keydown.enter)="fileInput.click()"
            (keydown.space)="fileInput.click()"
            (dragover)="handleDragOver($event)"
            (dragleave)="handleDragLeave()"
            (drop)="handleDrop($event)"
          >
            <input
              #fileInput
              type="file"
              hidden
              [accept]="acceptedFileTypes"
              (change)="handleFileInput($event)"
            />

            <svg viewBox="0 0 24 24">
              <path d="M16 16l-4-4-4 4"></path>

              <path d="M12 12v9"></path>

              <path
                d="M20.4 17.5A5 5 0 0 0 18 8.2 7 7 0 0 0 4.3 10.7 4.5 4.5 0 0 0 5 19.5h3"
              ></path>
            </svg>

            @if (selectedFile(); as file) {
              <div>
                <strong>{{ file.name }}</strong>

                <small>
                  {{ formatFileSize(file.size) }}
                  · Nhấn để chọn file khác
                </small>
              </div>

              <button
                class="remove-file-button"
                type="button"
                aria-label="Xóa file"
                (click)="removeFile($event)"
              >
                ×
              </button>
            } @else {
              <div>
                <strong> Kéo thả file vào đây hoặc nhấn để chọn file </strong>

                <small>
                  Định dạng:
                  {{ config.acceptedFileExtensions.join(', ') }}
                  (Tối đa
                  {{ config.maximumFileSizeMb }}MB)
                </small>
              </div>
            }
          </div>

          @if (fileError()) {
            <small class="field-error">
              {{ fileError() }}
            </small>
          }
        </div>

        <label class="terms-field">
          <input type="checkbox" formControlName="acceptedTerms" />

          <span class="custom-checkbox">
            <svg viewBox="0 0 24 24">
              <path d="m5 12 4 4L19 6"></path>
            </svg>
          </span>

          <span>
            Tôi cam kết tuân thủ
            <a routerLink="/dieu-khoan-su-dung" target="_blank"> Quy định nội dung </a>
            và
            <a routerLink="/quyen-rieng-tu" target="_blank"> Chính sách cộng đồng </a>
            của TruyenHub.
            <strong>*</strong>
          </span>
        </label>

        @if (hasError('acceptedTerms', 'required')) {
          <small class="field-error terms-error">
            Bạn cần đồng ý với quy định trước khi gửi.
          </small>
        }

        <footer class="form-actions">
          <button
            class="draft-button"
            type="button"
            [disabled]="submitting || draftSaving"
            (click)="handleSaveDraft()"
          >
            <svg viewBox="0 0 24 24">
              <path d="M5 3h11l3 3v15H5V3Z"></path>

              <path d="M8 3v6h8V3"></path>
              <path d="M8 15h8v6H8z"></path>
            </svg>

            {{ draftSaving ? 'Đang lưu...' : 'Lưu nháp' }}
          </button>

          <button class="submit-button" type="submit" [disabled]="submitting || draftSaving">
            @if (submitting) {
              <span class="loading-spinner"></span>

              Đang gửi yêu cầu...
            } @else {
              <svg viewBox="0 0 24 24">
                <path d="m22 2-7 20-4-9-9-4 20-7Z"></path>

                <path d="M22 2 11 13"></path>
              </svg>

              Gửi yêu cầu
            }
          </button>
        </footer>
      </form>
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .application-form-card {
        padding: 20px 24px 22px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.95), rgba(10, 15, 28, 0.95));
        box-shadow:
          0 20px 55px rgba(0, 0, 0, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.015);
      }

      .form-heading {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
      }

      .form-heading svg {
        width: 22px;
        height: 22px;
        color: #b967ff;
      }

      .form-heading h2 {
        margin: 0;
        color: #f7f5ff;
        font-size: 1.1rem;
        font-weight: 700;
      }

      form {
        display: grid;
        gap: 14px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px 20px;
      }

      .form-field {
        position: relative;
        display: grid;
        align-content: start;
        gap: 6px;
        min-width: 0;
      }

      .form-field--full {
        width: 100%;
      }

      label {
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 650;
      }

      label > span {
        color: #fb7185;
      }

      input,
      select,
      textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 8px;
        outline: none;
        background: rgba(7, 13, 27, 0.72);
        color: var(--text-strong);
        font: inherit;
        font-size: 14px;
        transition:
          border-color 140ms ease,
          box-shadow 140ms ease,
          background-color 140ms ease;
      }

      input,
      select {
        height: 44px;
        padding: 0 14px;
      }

      textarea {
        min-height: 90px;
        resize: vertical;
        padding: 12px 14px 24px;
        line-height: 1.55;
      }

      input::placeholder,
      textarea::placeholder {
        color: var(--text-muted);
      }

      input:focus,
      select:focus,
      textarea:focus {
        border-color: rgba(192, 132, 252, 0.5);
        background: rgba(9, 15, 30, 0.9);
        box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.12);
      }

      input.ng-invalid.ng-touched,
      select.ng-invalid.ng-touched,
      textarea.ng-invalid.ng-touched {
        border-color: rgba(251, 113, 133, 0.52);
      }

      select {
        padding-right: 36px;
        appearance: none;
        cursor: pointer;
      }

      select option {
        background: #11182c;
        color: #ffffff;
      }

      .select-wrap {
        position: relative;
      }

      .select-wrap svg {
        position: absolute;
        top: 50%;
        right: 12px;
        width: 17px;
        height: 17px;
        pointer-events: none;
        color: var(--text-muted);
        transform: translateY(-50%);
      }

      .character-count {
        position: absolute;
        right: 10px;
        bottom: 8px;
        color: var(--text-muted);
        font-size: 11.5px;
      }

      .field-error {
        display: block;
        color: #fb7185;
        font-size: 12px;
        line-height: 1.4;
      }

      .upload-zone {
        position: relative;
        display: flex;
        min-height: 80px;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 14px 20px;
        border: 1px dashed rgba(139, 151, 190, 0.3);
        border-radius: 9px;
        background: rgba(7, 13, 27, 0.45);
        color: var(--text-secondary);
        text-align: left;
        cursor: pointer;
        transition:
          border-color 140ms ease,
          background-color 140ms ease;
      }

      .upload-zone:hover,
      .upload-zone--dragging {
        border-color: rgba(192, 132, 252, 0.65);
        background: rgba(126, 34, 206, 0.08);
      }

      .upload-zone--selected {
        justify-content: flex-start;
        border-style: solid;
        border-color: rgba(74, 222, 128, 0.3);
      }

      .upload-zone > svg {
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        color: #b967ff;
      }

      .upload-zone div {
        display: grid;
        gap: 4px;
      }

      .upload-zone strong {
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 600;
      }

      .upload-zone small {
        color: var(--text-muted);
        font-size: 12px;
      }

      .remove-file-button {
        position: absolute;
        top: 50%;
        right: 14px;
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        border: 1px solid rgba(251, 113, 133, 0.25);
        border-radius: 50%;
        background: rgba(159, 18, 57, 0.12);
        color: #fb7185;
        font-size: 18px;
        cursor: pointer;
        transform: translateY(-50%);
      }

      .terms-field {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.5;
        cursor: pointer;
      }

      .terms-field input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .custom-checkbox {
        display: grid;
        width: 18px;
        height: 18px;
        flex: 0 0 auto;
        place-items: center;
        border: 1px solid rgba(192, 132, 252, 0.38);
        border-radius: 5px;
        background: rgba(76, 29, 149, 0.12);
        color: transparent;
      }

      .custom-checkbox svg {
        width: 13px;
        height: 13px;
      }

      .terms-field input:checked + .custom-checkbox {
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: #ffffff;
      }

      .terms-field a {
        color: #c084fc;
      }

      .terms-field strong {
        color: #fb7185;
      }

      .terms-error {
        margin-top: -5px;
        padding-left: 28px;
      }

      .form-actions {
        display: grid;
        grid-template-columns:
          minmax(150px, 0.9fr)
          minmax(220px, 1fr);
        gap: 12px;
        margin-top: 6px;
      }

      .form-actions button {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 8px;
        color: #ffffff;
        font: inherit;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .form-actions button:disabled {
        opacity: 0.58;
        cursor: not-allowed;
      }

      .draft-button {
        border: 1px solid rgba(139, 151, 190, 0.25);
        background: rgba(9, 15, 30, 0.7);
      }

      .draft-button:hover:not(:disabled) {
        border-color: rgba(192, 132, 252, 0.36);
        color: #d8b4fe;
      }

      .submit-button {
        border: 1px solid rgba(216, 180, 254, 0.24);
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        box-shadow: 0 7px 21px rgba(126, 34, 206, 0.23);
      }

      .submit-button:hover:not(:disabled) {
        background: linear-gradient(135deg, #b967ff, #8b5cf6);
      }

      .form-actions svg {
        width: 17px;
        height: 17px;
      }

      .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: form-spin 0.7s linear infinite;
      }

      .form-message {
        display: flex;
        min-height: 44px;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13.5px;
      }

      .form-message svg {
        width: 19px;
        height: 19px;
        flex: 0 0 auto;
      }

      .form-message--success {
        border: 1px solid rgba(74, 222, 128, 0.22);
        background: rgba(22, 163, 74, 0.09);
        color: #86efac;
      }

      .form-message--error {
        border: 1px solid rgba(251, 113, 133, 0.22);
        background: rgba(190, 18, 60, 0.09);
        color: #fda4af;
      }

      .application-form-card svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      @keyframes form-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 680px) {
        .application-form-card {
          padding: 15px 13px;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }

        .form-actions {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AuthorApplicationFormComponent {
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
