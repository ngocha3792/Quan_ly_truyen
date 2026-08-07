import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
    output,
    signal,
} from '@angular/core';

import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { ChangePasswordRequest } from '../../data/account-security.models';

import { AccountDialogShellComponent } from '../account-dialog-shell/account-dialog-shell.component';

interface ChangePasswordForm {
    currentPassword: FormControl<string>;
    newPassword: FormControl<string>;
    confirmPassword: FormControl<string>;
}

const STRONG_PASSWORD_PATTERN =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

@Component({
    selector:
        'app-change-password-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        IconComponent,
        AccountDialogShellComponent,
    ],
    template: `
    <app-account-dialog-shell
      [open]="open()"
      [busy]="submitting()"
      title="Đổi mật khẩu"
      dialogTitleId="change-password-title"
      (closed)="closed.emit()"
    >
      <form
        class="password-form"
        [formGroup]="form"
        (ngSubmit)="submit()"
      >
        <p class="form-description">
          Sử dụng mật khẩu mạnh mà bạn chưa
          từng sử dụng cho tài khoản này.
        </p>

        <label>
          <span>Mật khẩu hiện tại</span>

          <div class="password-field">
            <app-icon
              name="lock"
              [size]="17"
            />

            <input
              [type]="
                showCurrentPassword()
                  ? 'text'
                  : 'password'
              "
              formControlName="currentPassword"
              autocomplete="current-password"
              placeholder="Nhập mật khẩu hiện tại"
            />

            <button
              type="button"
              (click)="
                showCurrentPassword.update(
                  (value) => !value
                )
              "
            >
              <app-icon
                [name]="
                  showCurrentPassword()
                    ? 'eye-off'
                    : 'eye'
                "
                [size]="17"
              />
            </button>
          </div>
        </label>

        <label>
          <span>Mật khẩu mới</span>

          <div class="password-field">
            <app-icon
              name="key"
              [size]="17"
            />

            <input
              [type]="
                showNewPassword()
                  ? 'text'
                  : 'password'
              "
              formControlName="newPassword"
              autocomplete="new-password"
              maxlength="72"
              placeholder="Nhập mật khẩu mới"
            />

            <button
              type="button"
              (click)="
                showNewPassword.update(
                  (value) => !value
                )
              "
            >
              <app-icon
                [name]="
                  showNewPassword()
                    ? 'eye-off'
                    : 'eye'
                "
                [size]="17"
              />
            </button>
          </div>

          <small>
            8–72 ký tự, có chữ hoa, chữ thường,
            chữ số và ký tự đặc biệt.
          </small>
        </label>

        <label>
          <span>Xác nhận mật khẩu mới</span>

          <div class="password-field">
            <app-icon
              name="check"
              [size]="17"
            />

            <input
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
              maxlength="72"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
        </label>

        @if (
          form.hasError('passwordMismatch') &&
          form.controls.confirmPassword.touched
        ) {
          <div class="form-error">
            Mật khẩu xác nhận không trùng khớp.
          </div>
        }

        @if (
          form.controls.newPassword.invalid &&
          form.controls.newPassword.touched
        ) {
          <div class="form-error">
            Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.
          </div>
        }

        <div class="dialog-actions">
          <button
            class="cancel-button"
            type="button"
            [disabled]="submitting()"
            (click)="closed.emit()"
          >
            Hủy
          </button>

          <button
            class="submit-button"
            type="submit"
            [disabled]="
              submitting() ||
              form.invalid
            "
          >
            @if (submitting()) {
              <span class="spinner"></span>
            } @else {
              <app-icon
                name="lock"
                [size]="16"
              />
            }

            Đổi mật khẩu
          </button>
        </div>
      </form>
    </app-account-dialog-shell>
  `,
    styleUrl:
        './change-password-dialog.component.scss',
    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordDialogComponent {
    readonly open = input(false);
    readonly submitting = input(false);

    readonly closed = output<void>();

    readonly submitted =
        output<ChangePasswordRequest>();

    protected readonly showCurrentPassword =
        signal(false);

    protected readonly showNewPassword =
        signal(false);

    protected readonly form =
        new FormGroup<ChangePasswordForm>(
            {
                currentPassword:
                    new FormControl('', {
                        nonNullable: true,
                        validators: [
                            Validators.required,
                        ],
                    }),

                newPassword:
                    new FormControl('', {
                        nonNullable: true,
                        validators: [
                            Validators.required,
                            Validators.minLength(8),
                            Validators.maxLength(72),
                            Validators.pattern(
                                STRONG_PASSWORD_PATTERN,
                            ),
                        ],
                    }),

                confirmPassword:
                    new FormControl('', {
                        nonNullable: true,
                        validators: [
                            Validators.required,
                        ],
                    }),
            },
            {
                validators:
                    passwordsMatchValidator(),
            },
        );

    constructor() {
        effect(() => {
            if (!this.open()) {
                this.form.reset();
                this.showCurrentPassword.set(
                    false,
                );
                this.showNewPassword.set(false);
            }
        });
    }

    protected submit(): void {
        this.form.markAllAsTouched();

        if (
            this.form.invalid ||
            this.submitting()
        ) {
            return;
        }

        const value =
            this.form.getRawValue();

        this.submitted.emit({
            currentPassword:
                value.currentPassword,

            newPassword:
                value.newPassword,
        });
    }
}

function passwordsMatchValidator():
    ValidatorFn {
    return (
        control: AbstractControl,
    ): ValidationErrors | null => {
        const newPassword =
            control.get('newPassword')?.value;

        const confirmPassword =
            control.get('confirmPassword')?.value;

        return newPassword === confirmPassword
            ? null
            : {
                passwordMismatch: true,
            };
    };
}