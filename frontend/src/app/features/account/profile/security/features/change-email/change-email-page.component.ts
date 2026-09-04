import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { APP_RUNTIME_CONFIG } from '../../../../../../core/config/app-config.token';

import { AccountFormFieldComponent } from '../../../../shared/ui/account-form-field/account-form-field.component';
import { AccountPasswordInputComponent } from '../../../../shared/ui/account-password-input/account-password-input.component';

import { AccountSecurityStore } from '../../data/account-security.store';
import { SecurityFeatureShellComponent } from '../../ui/security-feature-shell/security-feature-shell.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';

interface ChangeEmailForm {
  newEmail: FormControl<string>;

  currentPassword: FormControl<string>;
}

@Component({
  selector: 'app-change-email-page',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    SecurityFeatureShellComponent,
    SecurityPanelComponent,
    AccountFormFieldComponent,
    AccountPasswordInputComponent,
  ],

  templateUrl: './change-email-page.component.html',

  styleUrl: './change-email-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeEmailPageComponent implements OnInit {
  protected readonly store = inject(AccountSecurityStore);

  protected readonly passwordMaximumLength =
    inject(APP_RUNTIME_CONFIG).passwordPolicy.maximumLength;

  protected readonly form = new FormGroup<ChangeEmailForm>({
    newEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),

    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.passwordMaximumLength)],
    }),
  });

  ngOnInit(): void {
    this.store.clearMessages();
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

    const currentEmail = (this.store.user()?.email ?? '').trim().toLowerCase();

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

    if (this.form.invalid || this.store.submitting()) {
      return;
    }

    const value = this.form.getRawValue();

    const newEmail = value.newEmail.trim();

    const currentEmail = (this.store.user()?.email ?? '').trim();

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      return;
    }

    this.store
      .requestEmailChange({
        newEmail,
        currentPassword: value.currentPassword,
      })
      .subscribe({
        next: () => {
          this.form.reset();
        },
      });
  }
}
