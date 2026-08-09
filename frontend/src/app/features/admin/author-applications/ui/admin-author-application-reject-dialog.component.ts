import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';

import {
  AUTHOR_REJECTION_REASON_MAX_LENGTH,
  AUTHOR_REJECTION_REASON_MIN_LENGTH,
} from '../domain/admin-author-application.models';

@Component({
  selector: 'app-admin-author-application-reject-dialog',

  standalone: true,

  imports: [ReactiveFormsModule],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-author-application-reject-dialog.component.html',

  styleUrl: './admin-author-application-reject-dialog.component.scss',
})
export class AdminAuthorApplicationRejectDialogComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = input(false);

  readonly confirm = output<string>();

  readonly cancel = output<void>(); // eslint-disable-line @angular-eslint/no-output-native -- legacy public output; rename in the Admin refactor wave.

  protected readonly minimumLength = AUTHOR_REJECTION_REASON_MIN_LENGTH;

  protected readonly maximumLength = AUTHOR_REJECTION_REASON_MAX_LENGTH;

  protected readonly form = this.formBuilder.nonNullable.group({
    reason: ['', [rejectionReasonValidator]],
  });

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    this.handleCancel();
  }

  protected handleCancel(): void {
    if (this.loading()) {
      return;
    }

    this.cancel.emit();
  }

  protected handleSubmit(): void {
    if (this.loading()) {
      return;
    }

    this.form.controls.reason.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.confirm.emit(this.form.controls.reason.value.trim());
  }
}

function rejectionReasonValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return {
      required: true,
    };
  }

  if (value.length < AUTHOR_REJECTION_REASON_MIN_LENGTH) {
    return {
      minlength: true,
    };
  }

  if (value.length > AUTHOR_REJECTION_REASON_MAX_LENGTH) {
    return {
      maxlength: true,
    };
  }

  return null;
}
