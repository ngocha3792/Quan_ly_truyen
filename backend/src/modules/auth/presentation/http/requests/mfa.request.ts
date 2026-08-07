import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { Trim } from '@/common/decorators';

/*
 * ========================
 * PRE-AUTH
 * ========================
 */

export class MfaTicketRequest {
  @Trim()
  @IsString()
  @MaxLength(256)
  mfaTicket!: string;
}

export class ConfirmMfaPreAuthEnrollmentRequest extends MfaTicketRequest {
  @Trim()
  @Matches(/^\d{6}$/u, {
    message: 'Mã TOTP phải gồm 6 chữ số',
  })
  totpCode!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

export class VerifyMfaPreAuthRequest extends MfaTicketRequest {
  @IsOptional()
  @Trim()
  @Matches(/^\d{6}$/u, {
    message: 'Mã TOTP phải gồm 6 chữ số',
  })
  totpCode?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

/*
 * ========================
 * SETTINGS
 * ========================
 */

export class BeginMfaSettingsEnrollmentRequest {
  /*
   * Không Trim password.
   */
  @IsString()
  @Length(1, 72)
  currentPassword!: string;
}

export class ConfirmMfaSettingsEnrollmentRequest {
  @IsUUID('4')
  enrollmentId!: string;

  @Trim()
  @Matches(/^\d{6}$/u, {
    message: 'Mã TOTP phải gồm 6 chữ số',
  })
  totpCode!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

export class VerifyMfaSensitiveActionRequest {
  /*
   * Không Trim password.
   */
  @IsString()
  @Length(1, 72)
  currentPassword!: string;

  @Trim()
  @Matches(/^\d{6}$/u, {
    message: 'Mã TOTP phải gồm 6 chữ số',
  })
  totpCode!: string;
}
