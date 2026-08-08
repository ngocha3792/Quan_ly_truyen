import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';

import {
  AUTHOR_REJECTION_REASON_MAX_LENGTH,
  AUTHOR_REJECTION_REASON_MIN_LENGTH,
} from '../domain/admin-author-application.models';

@Component({
  selector:
    'app-admin-author-application-reject-dialog',

  standalone: true,

  imports: [
    ReactiveFormsModule,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <div
      class="dialog-backdrop"
      role="presentation"
      (click)="handleCancel()"
    >
      <section
        class="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
        (click)="$event.stopPropagation()"
      >
        <h2
          id="reject-dialog-title"
        >
          Từ chối hồ sơ
        </h2>

        <p>
          Hãy ghi rõ lý do để người
          đăng ký biết phần nào cần
          chỉnh sửa trước khi gửi lại.
        </p>

        <form
          [formGroup]="form"
          (ngSubmit)="handleSubmit()"
        >
          <label
            for="author-rejection-reason"
          >
            Lý do từ chối
          </label>

          <textarea
            id="author-rejection-reason"
            rows="6"
            formControlName="reason"
            [attr.maxlength]="
              maximumLength
            "
            placeholder="Ví dụ: Mẫu chương truyện còn quá ngắn và chưa thể hiện rõ chất lượng nội dung..."
          ></textarea>

          <div class="field-footer">
            <div>
              @if (
                form.controls.reason.touched &&
                form.controls.reason.hasError(
                  'required'
                )
              ) {
                <small class="error">
                  Vui lòng nhập lý do từ chối.
                </small>
              }

              @if (
                form.controls.reason.touched &&
                form.controls.reason.hasError(
                  'minlength'
                )
              ) {
                <small class="error">
                  Lý do cần ít nhất
                  {{ minimumLength }}
                  ký tự.
                </small>
              }

              @if (
                form.controls.reason.touched &&
                form.controls.reason.hasError(
                  'maxlength'
                )
              ) {
                <small class="error">
                  Lý do không được vượt
                  quá
                  {{ maximumLength }}
                  ký tự.
                </small>
              }
            </div>

            <small class="counter">
              {{
                form.controls.reason.value
                  .length
              }}
              /
              {{ maximumLength }}
            </small>
          </div>

          <footer>
            <button
              type="button"
              class="cancel-button"
              [disabled]="loading()"
              (click)="cancel.emit()"
            >
              Hủy
            </button>

            <button
              type="submit"
              class="reject-button"
              [disabled]="loading()"
            >
              {{
                loading()
                  ? 'Đang từ chối...'
                  : 'Xác nhận từ chối'
              }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  `,

  styles: `
    .dialog-backdrop {
      position: fixed;

      inset: 0;

      z-index: 1000;

      display: grid;

      place-items: center;

      padding: 20px;

      background:
        rgba(
          2,
          6,
          23,
          0.78
        );

      backdrop-filter:
        blur(5px);
    }

    .dialog-card {
      width: min(
        520px,
        100%
      );

      padding: 28px;

      border:
        1px solid
        rgba(
          148,
          163,
          184,
          0.16
        );

      border-radius: 14px;

      background: #0f172a;

      box-shadow:
        0 24px 80px
        rgba(
          0,
          0,
          0,
          0.4
        );
    }

    h2 {
      margin:
        0 0 8px;

      color: #f8fafc;

      font-size: 20px;
    }

    p {
      margin:
        0 0 20px;

      color: #94a3b8;

      line-height: 1.6;
    }

    form {
      display: grid;

      gap: 8px;
    }

    label {
      color: #e2e8f0;

      font-size: 13px;

      font-weight: 700;
    }

    textarea {
      width: 100%;

      box-sizing: border-box;

      padding: 13px;

      resize: vertical;

      border:
        1px solid
        rgba(
          148,
          163,
          184,
          0.2
        );

      border-radius: 8px;

      outline: none;

      color: #f8fafc;

      font: inherit;

      line-height: 1.6;

      background:
        rgba(
          2,
          6,
          23,
          0.55
        );
    }

    textarea:focus {
      border-color:
        rgba(
          168,
          85,
          247,
          0.52
        );
    }

    .field-footer {
      min-height: 20px;

      display: flex;

      justify-content:
        space-between;

      gap: 12px;
    }

    small {
      font-size: 11px;
    }

    .error {
      color: #fda4af;
    }

    .counter {
      margin-left: auto;

      color: #64748b;
    }

    footer {
      margin-top: 16px;

      display: flex;

      justify-content:
        flex-end;

      gap: 10px;
    }

    button {
      min-height: 40px;

      padding: 0 17px;

      border-radius: 8px;

      font-weight: 700;

      cursor: pointer;
    }

    button:disabled {
      opacity: 0.55;

      cursor: not-allowed;
    }

    .cancel-button {
      border:
        1px solid
        rgba(
          148,
          163,
          184,
          0.2
        );

      color: #cbd5e1;

      background:
        transparent;
    }

    .reject-button {
      border: 0;

      color: #fff;

      background:
        linear-gradient(
          135deg,
          #be123c,
          #e11d48
        );
    }
  `,
})
export class AdminAuthorApplicationRejectDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  readonly loading =
    input(false);

  readonly confirm =
    output<string>();

  readonly cancel =
    output<void>();

  protected readonly minimumLength =
    AUTHOR_REJECTION_REASON_MIN_LENGTH;

  protected readonly maximumLength =
    AUTHOR_REJECTION_REASON_MAX_LENGTH;

  protected readonly form =
    this.formBuilder.nonNullable.group({
      reason: [
        '',

        [
          rejectionReasonValidator,
        ],
      ],
    });

  @HostListener(
    'document:keydown.escape',
  )
  protected handleEscape(): void {
    this.handleCancel();
  }

  protected handleCancel(): void {
    if (this.loading()) {
      return;
    }

    this.cancel.emit();
  }

  protected handleSubmit(): void {
    if (this.loading()) {
      return;
    }

    this.form.controls.reason.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.confirm.emit(
      this.form.controls.reason.value.trim(),
    );
  }
}

function rejectionReasonValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const value =
    String(
      control.value ?? '',
    ).trim();

  if (!value) {
    return {
      required: true,
    };
  }

  if (
    value.length <
    AUTHOR_REJECTION_REASON_MIN_LENGTH
  ) {
    return {
      minlength: true,
    };
  }

  if (
    value.length >
    AUTHOR_REJECTION_REASON_MAX_LENGTH
  ) {
    return {
      maxlength: true,
    };
  }

  return null;
}
