import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { RecoveryEmailStore } from '../../data-access/recovery-email.store';

import { OtpCodeInputComponent } from '../../ui/otp-code-input/otp-code-input.component';
import { SecurityFeatureShellComponent } from '../../ui/security-feature-shell/security-feature-shell.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';
import { AccountSecurityStore } from '../../data/account-security.store';
@Component({
  selector: 'app-recovery-email-page',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    SecurityFeatureShellComponent,
    SecurityPanelComponent,
    OtpCodeInputComponent,
  ],

  templateUrl: './recovery-email-page.component.html',

  styleUrl: './recovery-email-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryEmailPageComponent implements OnInit {
  protected readonly store = inject(RecoveryEmailStore);

  protected readonly verificationCode = signal('');
  private readonly accountSecurity = inject(AccountSecurityStore);

  protected readonly requestForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),

    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly removeForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected requestEmail(): void {
    this.requestForm.markAllAsTouched();

    if (this.requestForm.invalid || this.store.submitting()) {
      return;
    }

    this.store.request(this.requestForm.getRawValue()).subscribe({
      next: () => {
        this.requestForm.reset();
      },
    });
  }

  protected verifyEmail(): void {
    if (this.verificationCode().length !== 6 || this.store.submitting()) {
      return;
    }

    this.store
      .verify({
        code: this.verificationCode(),
      })
      .subscribe({
        next: () => {
          this.verificationCode.set('');

          /*
           * Recovery email verified thay đổi
           * security-overview.
           */
          this.accountSecurity.load(true);
        },
      });
  }

  protected resend(): void {
    this.store.resend().subscribe();
  }

  protected remove(): void {
    this.removeForm.markAllAsTouched();

    if (this.removeForm.invalid || this.store.submitting()) {
      return;
    }

    this.store.remove(this.removeForm.getRawValue()).subscribe({
      next: () => {
        this.removeForm.reset();

        this.accountSecurity.load(true);
      },
    });
  }
}
