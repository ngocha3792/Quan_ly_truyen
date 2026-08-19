import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { evaluatePasswordPolicy } from '../../../../../core/auth/password-policy';
import type { ResetPasswordConfig } from '../../domain/reset-password.models';

export function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmation = control.get('confirmPassword')?.value;
    if (!password || !confirmation) return null;
    return password === confirmation ? null : { passwordMismatch: true };
  };
}

export function passwordComplexityValidator(config: ResetPasswordConfig): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const evaluation = evaluatePasswordPolicy(String(control.value ?? ''), config);
    return evaluation.valid ? null : { passwordPolicy: evaluation };
  };
}
