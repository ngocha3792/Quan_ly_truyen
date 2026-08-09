import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { AccountPasswordInputComponent } from '../../../shared/ui/account-password-input/account-password-input.component';

import { AuthFlowCardComponent } from '../../../shared/ui/auth-flow-card/auth-flow-card.component';

import {
  ResetPasswordConfig,
  ResetPasswordResult,
  ResetPasswordStatus,
  ResetPasswordTokenValidation,
} from '../../domain/reset-password.models';
import { passwordComplexityValidator, passwordsMatchValidator } from './reset-password.validators';

@Component({
  selector: 'app-reset-password-card',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    RouterLink,

    IconComponent,
    AccountPasswordInputComponent,
    AuthFlowCardComponent,
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './reset-password-card.component.html',

  styleUrl: './reset-password-card.component.scss',
})
export class ResetPasswordCardComponent implements OnChanges {
  @Input()
  status: ResetPasswordStatus = 'idle';

  @Input()
  config: ResetPasswordConfig = {
    minimumLength: 8,
    maximumLength: 64,
    tokenExpiresInMinutes: 15,
  };

  @Input()
  tokenValidation: ResetPasswordTokenValidation | null = null;

  @Input()
  result: ResetPasswordResult | null = null;

  @Input()
  errorMessage = '';

  @Output()
  readonly passwordSubmitted = new EventEmitter<string>();

  @Output()
  readonly retryValidation = new EventEmitter<void>();

  @Output()
  readonly errorCleared = new EventEmitter<void>();

  protected readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,

        validators: [Validators.required, passwordComplexityValidator(8), Validators.maxLength(72)],
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.passwordControl.setValidators([
        Validators.required,

        passwordComplexityValidator(this.config.minimumLength),

        Validators.maxLength(this.config.maximumLength),
      ]);

      this.passwordControl.updateValueAndValidity({
        emitEvent: false,
      });
    }
  }

  protected get passwordControl(): FormControl<string> {
    return this.form.controls.password;
  }

  protected get confirmPasswordControl(): FormControl<string> {
    return this.form.controls.confirmPassword;
  }

  protected get passwordError(): string {
    if (!this.passwordControl.touched) {
      return '';
    }

    if (this.passwordControl.hasError('required')) {
      return 'Vui lòng nhập mật khẩu mới.';
    }

    if (this.passwordControl.invalid) {
      return 'Mật khẩu mới chưa đáp ứng đầy đủ yêu cầu bên dưới.';
    }

    return '';
  }

  protected get confirmPasswordError(): string {
    if (!this.confirmPasswordControl.touched) {
      return '';
    }

    if (this.confirmPasswordControl.hasError('required')) {
      return 'Vui lòng nhập lại mật khẩu.';
    }

    if (this.form.hasError('passwordMismatch')) {
      return 'Mật khẩu xác nhận không khớp.';
    }

    return '';
  }

  protected hasMinimumLength(): boolean {
    return this.passwordControl.value.length >= this.config.minimumLength;
  }

  protected hasUppercase(): boolean {
    return /[A-Z]/.test(this.passwordControl.value);
  }

  protected hasNumber(): boolean {
    return /[0-9]/.test(this.passwordControl.value);
  }

  protected hasSpecialCharacter(): boolean {
    return /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(this.passwordControl.value);
  }

  protected handleSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.passwordSubmitted.emit(this.passwordControl.value);
  }
}
