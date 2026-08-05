import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
    output,
} from '@angular/core';

import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { DeleteAccountRequest } from '../../data/account-security.models';

import { AccountDialogShellComponent } from '../account-dialog-shell/account-dialog-shell.component';

interface DeleteAccountForm {
    password: FormControl<string>;
    confirmation: FormControl<string>;
}

const DELETE_CONFIRMATION =
    'XOA TAI KHOAN';

@Component({
    selector:
        'app-delete-account-dialog',
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
      title="Xóa tài khoản"
      eyebrow="KHU VỰC NGUY HIỂM"
      dialogTitleId="delete-account-title"
      (closed)="closed.emit()"
    >
      <form
        class="delete-form"
        [formGroup]="form"
        (ngSubmit)="submit()"
      >
        <div class="warning-box">
          <app-icon
            name="alert-triangle"
            [size]="22"
          />

          <div>
            <strong>
              Hành động này không thể hoàn tác
            </strong>

            <p>
              Tài khoản, phiên đăng nhập và dữ liệu
              cá nhân của bạn sẽ bị xóa vĩnh viễn.
            </p>
          </div>
        </div>

        <label>
          <span>Mật khẩu hiện tại</span>

          <div class="input-field">
            <app-icon
              name="lock"
              [size]="17"
            />

            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="Nhập mật khẩu"
            />
          </div>
        </label>

        <label>
          <span>
            Nhập
            <strong>
              {{ confirmationText }}
            </strong>
            để xác nhận
          </span>

          <div class="input-field">
            <app-icon
              name="trash"
              [size]="17"
            />

            <input
              type="text"
              formControlName="confirmation"
              autocomplete="off"
              [placeholder]="
                confirmationText
              "
            />
          </div>
        </label>

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
              submitting() ||
              form.invalid ||
              form.controls.confirmation
                .value !== confirmationText
            "
          >
            @if (submitting()) {
              <span class="spinner"></span>
            } @else {
              <app-icon
                name="trash"
                [size]="16"
              />
            }

            Xóa vĩnh viễn
          </button>
        </div>
      </form>
    </app-account-dialog-shell>
  `,
    styleUrl:
        './delete-account-dialog.component.scss',
    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountDialogComponent {
    readonly open = input(false);
    readonly submitting = input(false);

    readonly closed = output<void>();

    readonly submitted =
        output<DeleteAccountRequest>();

    protected readonly confirmationText =
        DELETE_CONFIRMATION;

    protected readonly form =
        new FormGroup<DeleteAccountForm>({
            password:
                new FormControl('', {
                    nonNullable: true,
                    validators: [
                        Validators.required,
                    ],
                }),

            confirmation:
                new FormControl('', {
                    nonNullable: true,
                    validators: [
                        Validators.required,
                    ],
                }),
        });

    constructor() {
        effect(() => {
            if (!this.open()) {
                this.form.reset();
            }
        });
    }

    protected submit(): void {
        this.form.markAllAsTouched();

        const value =
            this.form.getRawValue();

        if (
            this.form.invalid ||
            this.submitting() ||
            value.confirmation !==
            DELETE_CONFIRMATION
        ) {
            return;
        }

        this.submitted.emit({
            password: value.password,
            confirmation:
                value.confirmation,
        });
    }
}