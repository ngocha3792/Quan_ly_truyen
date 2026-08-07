import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { MfaSettingsStore } from '../../data-access/mfa-settings.store';

import { MfaQrCodeComponent } from '../../ui/mfa-qr-code/mfa-qr-code.component';
import { OtpCodeInputComponent } from '../../ui/otp-code-input/otp-code-input.component';
import { RecoveryCodesComponent } from '../../ui/recovery-codes/recovery-codes.component';
import { SecurityFeatureShellComponent } from '../../ui/security-feature-shell/security-feature-shell.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';

@Component({
  selector: 'app-mfa-settings-page',

  standalone: true,

  imports: [
    DatePipe,
    ReactiveFormsModule,
    IconComponent,
    SecurityFeatureShellComponent,
    SecurityPanelComponent,
    OtpCodeInputComponent,
    MfaQrCodeComponent,
    RecoveryCodesComponent,
  ],

  templateUrl: './mfa-settings-page.component.html',

  styleUrl: './mfa-settings-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaSettingsPageComponent implements OnInit {
  protected readonly store = inject(MfaSettingsStore);

  protected readonly setupCode = signal('');

  protected readonly sensitiveCode = signal('');

  protected readonly copiedSecret = signal(false);

  protected readonly beginForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly disableForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly regenerateForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  @ViewChild('setupOtp')
  private setupOtp?: OtpCodeInputComponent;

  ngOnInit(): void {
    this.store.load();
  }

  protected beginEnrollment(): void {
    this.beginForm.markAllAsTouched();

    if (this.beginForm.invalid || this.store.submitting()) {
      return;
    }

    this.store.beginEnrollment(this.beginForm.getRawValue()).subscribe({
      next: () => {
        this.beginForm.reset();
      },
    });
  }

  protected confirmEnrollment(): void {
    const enrollment = this.store.enrollment();

    if (!enrollment || this.setupCode().length !== 6 || this.store.submitting()) {
      return;
    }

    this.store
      .confirmEnrollment({
        enrollmentId: enrollment.enrollmentId,

        totpCode: this.setupCode(),

        deviceName: this.getDeviceName(),
      })
      .subscribe({
        error: () => {
          this.setupOtp?.reset();
        },
      });
  }

  protected disableMfa(): void {
    this.disableForm.markAllAsTouched();

    if (this.disableForm.invalid || this.sensitiveCode().length !== 6) {
      return;
    }

    this.store
      .disable({
        currentPassword: this.disableForm.controls.currentPassword.value,

        totpCode: this.sensitiveCode(),
      })
      .subscribe({
        next: () => {
          this.disableForm.reset();
          this.sensitiveCode.set('');
        },
      });
  }

  protected regenerateCodes(): void {
    this.regenerateForm.markAllAsTouched();

    if (this.regenerateForm.invalid || this.sensitiveCode().length !== 6) {
      return;
    }

    this.store
      .regenerateRecoveryCodes({
        currentPassword: this.regenerateForm.controls.currentPassword.value,

        totpCode: this.sensitiveCode(),
      })
      .subscribe({
        next: () => {
          this.regenerateForm.reset();
          this.sensitiveCode.set('');
        },
      });
  }

  protected async copySecret(): Promise<void> {
    const secret = this.store.enrollment()?.secret;

    if (!secret) {
      return;
    }

    await navigator.clipboard.writeText(secret);

    this.copiedSecret.set(true);

    window.setTimeout(() => {
      this.copiedSecret.set(false);
    }, 1500);
  }

  private getDeviceName(): string {
    if (typeof navigator === 'undefined') {
      return 'TruyenHub Web';
    }

    return `TruyenHub Web - ${navigator.platform || 'Browser'}`;
  }
}
