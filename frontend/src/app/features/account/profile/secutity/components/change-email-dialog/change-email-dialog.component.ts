import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { AccountDialogShellComponent } from '../../../../shared/ui/account-dialog-shell/account-dialog-shell.component';

import { AccountFormFieldComponent } from '../../../../shared/ui/account-form-field/account-form-field.component';

import { AccountPasswordInputComponent } from '../../../../shared/ui/account-password-input/account-password-input.component';

import { ChangeEmailRequest } from '../../data/account-security.models';

interface ChangeEmailForm {
  newEmail: FormControl<string>;

  currentPassword: FormControl<string>;
}

@Component({
  selector: 'app-change-email-dialog',

  standalone: true,

  imports: [
    ReactiveFormsModule,

    IconComponent,

    AccountDialogShellComponent,

    AccountFormFieldComponent,

    AccountPasswordInputComponent,
  ],

  template: `
    <app-account-dialog-shell
      [open]="open()"
      [busy]="submitting()"
      title="Đổi email đăng nhập"
      dialogTitleId="change-email-title"
      (closed)="closed.emit()"
    >
      <form class="email-form" [formGroup]="form" (ngSubmit)="submit()">
        <p class="form-description">Email hiện tại</p>

        <div class="current-email">
          <app-icon name="mail" [size]="17" />

          <span>
            {{ currentEmail() || 'Không xác định' }}
          </span>
        </div>

        <p class="security-note">
          Bạn sẽ phải xác nhận email mới trước khi thay đổi có hiệu lực. Sau khi xác nhận, toàn bộ
          phiên đăng nhập hiện tại sẽ bị thu hồi.
        </p>

        <app-account-form-field
          label="Email mới"
          type="email"
          icon="mail"
          autocomplete="email"
          placeholder="email-moi@example.com"
          [maxLength]="320"
          formControlName="newEmail"
          [error]="newEmailError"
        />

        <app-account-password-input
          label="Mật khẩu hiện tại"
          icon="lock"
          autocomplete="current-password"
          placeholder="Nhập mật khẩu hiện tại"
          [maxLength]="72"
          formControlName="currentPassword"
          [error]="currentPasswordError"
        />

        <div class="dialog-actions">
          <button
            class="cancel-button"
            type="button"
            [disabled]="submitting()"
            (click)="closed.emit()"
          >
            Hủy
          </button>

          <button class="submit-button" type="submit" [disabled]="submitting() || form.invalid">
            @if (submitting()) {
              <span class="spinner"></span>
            } @else {
              <app-icon name="mail" [size]="16" />
            }

            Gửi link xác nhận
          </button>
        </div>
      </form>
    </app-account-dialog-shell>
  `,

  styleUrl: './change-email-dialog.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeEmailDialogComponent {
  readonly open = input(false);

  readonly submitting = input(false);

  readonly currentEmail = input('');

  readonly closed = output<void>();

  readonly submitted = output<ChangeEmailRequest>();

  protected readonly form = new FormGroup<ChangeEmailForm>({
    newEmail: new FormControl('', {
      nonNullable: true,

      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),

    currentPassword: new FormControl('', {
      nonNullable: true,

      validators: [Validators.required, Validators.maxLength(72)],
    }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.form.reset();
      }
    });
  }

  protected get newEmailError(): string {
    const control = this.form.controls.newEmail;

    if (!control.touched) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Vui lòng nhập email mới.';
    }

    if (control.hasError('email')) {
      return 'Email mới không hợp lệ.';
    }

    if (control.hasError('maxlength')) {
      return 'Email không được vượt quá 320 ký tự.';
    }

    const newEmail = control.value.trim().toLowerCase();

    const currentEmail = this.currentEmail().trim().toLowerCase();

    if (newEmail && currentEmail && newEmail === currentEmail) {
      return 'Email mới phải khác email hiện tại.';
    }

    return '';
  }

  protected get currentPasswordError(): string {
    const control = this.form.controls.currentPassword;

    if (!control.touched) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Vui lòng nhập mật khẩu hiện tại.';
    }

    if (control.hasError('maxlength')) {
      return 'Mật khẩu hiện tại không hợp lệ.';
    }

    return '';
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    const value = this.form.getRawValue();

    const newEmail = value.newEmail.trim();

    const currentEmail = this.currentEmail().trim();

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      return;
    }

    this.submitted.emit({
      newEmail,

      currentPassword: value.currentPassword,
    });
  }
}
