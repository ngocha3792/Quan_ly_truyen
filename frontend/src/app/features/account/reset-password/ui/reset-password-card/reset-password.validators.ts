import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmation = control.get('confirmPassword')?.value;
    if (!password || !confirmation) return null;
    return password === confirmation ? null : { passwordMismatch: true };
  };
}

export function passwordComplexityValidator(minimumLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    const errors: ValidationErrors = {};
    if (value.length < minimumLength) errors['passwordMinimumLength'] = true;
    if (!/[A-Z]/.test(value)) errors['passwordUppercase'] = true;
    if (!/[0-9]/.test(value)) errors['passwordNumber'] = true;
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(value)) errors['passwordSpecial'] = true;
    return Object.keys(errors).length > 0 ? errors : null;
  };
}
