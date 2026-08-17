import type { LoginResultDto } from './login-result.dto';

export interface MfaStatusDto {
  enabled: boolean;
  configuredAt: Date | null;
  recoveryCodesRemaining: number;
}

export interface MfaEnrollmentResultDto {
  enrollmentId?: string;
  secret: string;
  otpAuthUri: string;
  expiresAt: Date;
}

export interface MfaAuthenticatedResultDto extends LoginResultDto {
  recoveryCodes?: readonly string[];
}

export interface MfaSettingsEnrollmentResultDto {
  enrollmentId: string;
  secret: string;
  otpAuthUri: string;
  expiresAt: Date;
}

export interface MfaSettingsConfirmationResultDto {
  status: MfaStatusDto;
  recoveryCodes: readonly string[];
}

export interface MfaRecoveryCodesResultDto {
  recoveryCodes: readonly string[];
  generatedAt: Date;
}
