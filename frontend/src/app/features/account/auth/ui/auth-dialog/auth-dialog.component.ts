import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { BrandLogoComponent } from '../../../../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { MfaQrCodeComponent } from '../../../shared/ui/mfa-qr-code/mfa-qr-code.component';
import { AuthDialogController } from './auth-dialog.controller';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [FormsModule, RouterLink, BrandLogoComponent, IconComponent, MfaQrCodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent extends AuthDialogController {}
