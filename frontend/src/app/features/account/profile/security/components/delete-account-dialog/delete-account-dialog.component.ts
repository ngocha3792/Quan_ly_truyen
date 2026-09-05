import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { DialogShellComponent } from '../../../../../../shared/components/dialog-shell/dialog-shell.component';

import { AccountFormFieldComponent } from '../../../../shared/ui/account-form-field/account-form-field.component';

import { AccountPasswordInputComponent } from '../../../../shared/ui/account-password-input/account-password-input.component';

import { DeleteAccountRequest } from '../../data/account-security.models';

interface DeleteAccountForm {
  password: FormControl<string>;

  confirmation: FormControl<string>;
}

const DELETE_CONFIRMATION = 'XOA TAI KHOAN';

@Component({
  selector: 'app-delete-account-dialog',

  standalone: true,

  imports: [
    ReactiveFormsModule,

    IconComponent,

    DialogShellComponent,
    AccountFormFieldComponent,
    AccountPasswordInputComponent,
  ],

  template: `
    <app-dialog-shell
      [open]="open()"
      [busy]="submitting()"
      title="Xóa tài khoản"
      eyebrow="KHU VỰC NGUY HIỂM"
      dialogTitleId="delete-account-title"
      (closed)="closed.emit()"
    >
      <form class="delete-form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="warning-box">
          <app-icon name="alert-triangle" [size]="22" />

          <div>
            <strong> Hành động này không thể hoàn tác </strong>

            <p>Tài khoản, phiên đăng nhập và dữ liệu cá nhân của bạn sẽ bị xóa vĩnh viễn.</p>
          </div>
        </div>

        <app-account-password-input
          label="Mật khẩu hiện tại"
          icon="lock"
          autocomplete="current-password"
          placeholder="Nhập mật khẩu"
          formControlName="password"
          [error]="passwordError"
        />

        <app-account-form-field
          label="Nhập XOA TAI KHOAN để xác nhận"
          icon="trash"
          autocomplete="off"
          [placeholder]="confirmationText"
          formControlName="confirmation"
          [error]="confirmationError"
        />

        <div class="dialog-actions">
          <button
            class="cancel-button"
            type="button"
            [disabled]="submitting()"
            (click)="closed.emit()"
          >
            Giữ tài khoản
          </button>

          <button
            class="delete-button"
            type="submit"
            [disabled]="
              submitting() || form.invalid || form.controls.confirmation.value !== confirmationText
            "
          >
            @if (submitting()) {
              <span class="spinner"></span>
            } @else {
              <app-icon name="trash" [size]="16" />
            }

            Xóa vĩnh viễn
          </button>
        </div>
      </form>
    </app-dialog-shell>
  `,

  styleUrl: './delete-account-dialog.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountDialogComponent {
  readonly open = input(false);

  readonly submitting = input(false);

  readonly closed = output<void>();

  readonly submitted = output<DeleteAccountRequest>();

  protected readonly confirmationText = DELETE_CONFIRMATION;

  protected readonly form = new FormGroup<DeleteAccountForm>({
    password: new FormControl('', {
      nonNullable: true,

      validators: [Validators.required],
    }),

    confirmation: new FormControl('', {
      nonNullable: true,

      validators: [Validators.required],
    }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.form.reset();
      }
    });
  }

  protected get passwordError(): string {
    const control = this.form.controls.password;

    return control.touched && control.hasError('required')
      ? 'Vui lòng nhập mật khẩu hiện tại.'
      : '';
  }

  protected get confirmationError(): string {
    const control = this.form.controls.confirmation;

    if (!control.touched) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Vui lòng nhập cụm từ xác nhận.';
    }

    return control.value !== DELETE_CONFIRMATION
      ? `Hãy nhập chính xác ${DELETE_CONFIRMATION}.`
      : '';
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    const value = this.form.getRawValue();

    if (this.form.invalid || this.submitting() || value.confirmation !== DELETE_CONFIRMATION) {
      return;
    }

    this.submitted.emit({
      password: value.password,

      confirmation: value.confirmation,
    });
  }
}
