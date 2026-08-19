import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';

import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import {
  APP_RUNTIME_CONFIG,
  type AuthPasswordPolicyConfig,
} from '../../../../../../core/config/app-config.token';
import {
  evaluatePasswordPolicy,
  passwordPolicyHint,
} from '../../../../../../core/auth/password-policy';
import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { AccountDialogShellComponent } from '../../../../shared/ui/account-dialog-shell/account-dialog-shell.component';

import { AccountPasswordInputComponent } from '../../../../shared/ui/account-password-input/account-password-input.component';

import { ChangePasswordRequest } from '../../data/account-security.models';

interface ChangePasswordForm {
  currentPassword: FormControl<string>;

  newPassword: FormControl<string>;

  confirmPassword: FormControl<string>;
}

@Component({
  selector: 'app-change-password-dialog',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    IconComponent,
    AccountDialogShellComponent,
    AccountPasswordInputComponent,
  ],

  template: `
    <app-account-dialog-shell
      [open]="open()"
      [busy]="submitting()"
      title="Đổi mật khẩu"
      dialogTitleId="change-password-title"
      (closed)="closed.emit()"
    >
      <form class="password-form" [formGroup]="form" (ngSubmit)="submit()">
        <p class="form-description">
          Sử dụng mật khẩu mạnh mà bạn chưa từng sử dụng cho tài khoản này.
        </p>

        <app-account-password-input
          label="Mật khẩu hiện tại"
          icon="lock"
          autocomplete="current-password"
          placeholder="Nhập mật khẩu hiện tại"
          formControlName="currentPassword"
          [error]="currentPasswordError"
        />

        <app-account-password-input
          label="Mật khẩu mới"
          icon="key"
          autocomplete="new-password"
          placeholder="Nhập mật khẩu mới"
          [maxLength]="passwordPolicy.maximumLength"
          formControlName="newPassword"
          [hint]="passwordHint"
          [error]="newPasswordError"
        />

        <app-account-password-input
          label="Xác nhận mật khẩu mới"
          icon="check"
          autocomplete="new-password"
          placeholder="Nhập lại mật khẩu mới"
          [maxLength]="passwordPolicy.maximumLength"
          formControlName="confirmPassword"
          [error]="confirmPasswordError"
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
              <app-icon name="lock" [size]="16" />
            }

            Đổi mật khẩu
          </button>
        </div>
      </form>
    </app-account-dialog-shell>
  `,

  styleUrl: './change-password-dialog.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordDialogComponent {
  protected readonly passwordPolicy = inject(APP_RUNTIME_CONFIG).passwordPolicy;

  protected readonly passwordHint = passwordPolicyHint(this.passwordPolicy);

  readonly open = input(false);

  readonly submitting = input(false);

  readonly closed = output<void>();

  readonly submitted = output<ChangePasswordRequest>();

  protected readonly form = new FormGroup<ChangePasswordForm>(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,

        validators: [Validators.required],
      }),

      newPassword: new FormControl('', {
        nonNullable: true,

        validators: [
          Validators.required,

          Validators.minLength(this.passwordPolicy.minimumLength),

          Validators.maxLength(this.passwordPolicy.maximumLength),

          passwordPolicyValidator(this.passwordPolicy),
        ],
      }),

      confirmPassword: new FormControl('', {
        nonNullable: true,

        validators: [Validators.required],
      }),
    },
    {
      validators: passwordsMatchValidator(),
    },
  );

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.form.reset();
      }
    });
  }

  protected get currentPasswordError(): string {
    const control = this.form.controls.currentPassword;

    return control.touched && control.hasError('required')
      ? 'Vui lòng nhập mật khẩu hiện tại.'
      : '';
  }

  protected get newPasswordError(): string {
    const control = this.form.controls.newPassword;

    if (!control.touched) {
      return '';
    }

    return control.invalid ? 'Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.' : '';
  }

  protected get confirmPasswordError(): string {
    const control = this.form.controls.confirmPassword;

    if (!control.touched) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Vui lòng xác nhận mật khẩu mới.';
    }

    return this.form.hasError('passwordMismatch') ? 'Mật khẩu xác nhận không trùng khớp.' : '';
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    const value = this.form.getRawValue();

    this.submitted.emit({
      currentPassword: value.currentPassword,

      newPassword: value.newPassword,
    });
  }
}

function passwordPolicyValidator(policy: AuthPasswordPolicyConfig): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    evaluatePasswordPolicy(String(control.value ?? ''), policy).valid
      ? null
      : { passwordPolicy: true };
}

function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const newPassword = control.get('newPassword')?.value;

    const confirmPassword = control.get('confirmPassword')?.value;

    return newPassword === confirmPassword
      ? null
      : {
          passwordMismatch: true,
        };
  };
}
