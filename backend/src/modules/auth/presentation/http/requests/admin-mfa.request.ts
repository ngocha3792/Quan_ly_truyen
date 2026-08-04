import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '@/common/decorators';

export class AdminMfaTicketRequest {
  @Trim()
  @IsString()
  @MaxLength(256)
  mfaTicket!: string;
}

export class ConfirmAdminMfaEnrollmentRequest extends AdminMfaTicketRequest {
  @Trim()
  @Matches(/^\d{6}$/u, { message: 'Mã TOTP phải gồm 6 chữ số' })
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

export class VerifyAdminMfaRequest extends AdminMfaTicketRequest {
  @IsOptional()
  @Trim()
  @Matches(/^\d{6}$/u, { message: 'Mã TOTP phải gồm 6 chữ số' })
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
