import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

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

import { AccountPasswordInputComponent } from '../../../../shared/ui/account-password-input/account-password-input.component';

import { AccountSecurityStore } from '../../data/account-security.store';
import { SecurityFeatureShellComponent } from '../../ui/security-feature-shell/security-feature-shell.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';

interface ChangePasswordForm {
  currentPassword: FormControl<string>;

  newPassword: FormControl<string>;

  confirmPassword: FormControl<string>;
}

@Component({
  selector: 'app-change-password-page',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    SecurityFeatureShellComponent,
    SecurityPanelComponent,
    AccountPasswordInputComponent,
  ],

  templateUrl: './change-password-page.component.html',

  styleUrl: './change-password-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPageComponent implements OnInit {
  protected readonly store = inject(AccountSecurityStore);

  protected readonly passwordPolicy = inject(APP_RUNTIME_CONFIG).passwordPolicy;

  protected readonly passwordHint = passwordPolicyHint(this.passwordPolicy);

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

  ngOnInit(): void {
    this.store.clearMessages();
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

    if (this.form.invalid || this.store.submitting()) {
      return;
    }

    const value = this.form.getRawValue();

    this.store
      .changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
      .subscribe({
        next: () => {
          this.form.reset();
        },
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
