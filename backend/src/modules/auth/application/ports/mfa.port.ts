import type { LoginClientContext } from '../commands/login/login.command';
import type {
  MfaAuthenticatedResultDto,
  MfaEnrollmentResultDto,
  MfaRecoveryCodesResultDto,
  MfaSettingsConfirmationResultDto,
  MfaSettingsEnrollmentResultDto,
  MfaStatusDto,
} from '../dto';

export const MFA_PORT = Symbol('MFA_PORT');

export interface MfaPort {
  beginPreAuthEnrollment(ticket: string): Promise<MfaEnrollmentResultDto>;

  confirmPreAuthEnrollment(
    ticket: string,
    totpCode: string,
    clientOverride: LoginClientContext,
  ): Promise<MfaAuthenticatedResultDto>;

  verifyPreAuth(
    ticket: string,
    verification: {
      totpCode?: string;
      recoveryCode?: string;
    },
    clientOverride: LoginClientContext,
  ): Promise<MfaAuthenticatedResultDto>;

  getStatus(userId: string | undefined): Promise<MfaStatusDto>;

  beginSettingsEnrollment(
    userId: string | undefined,
    currentPassword: string,
  ): Promise<MfaSettingsEnrollmentResultDto>;

  confirmSettingsEnrollment(
    userId: string | undefined,
    sessionId: string | undefined,
    enrollmentId: string,
    totpCode: string,
    deviceName: string | undefined,
    client: LoginClientContext,
  ): Promise<MfaSettingsConfirmationResultDto>;

  disable(
    userId: string | undefined,
    sessionId: string | undefined,
    currentPassword: string,
    totpCode: string,
    client: LoginClientContext,
  ): Promise<MfaStatusDto>;

  regenerateRecoveryCodes(
    userId: string | undefined,
    sessionId: string | undefined,
    currentPassword: string,
    totpCode: string,
    client: LoginClientContext,
  ): Promise<MfaRecoveryCodesResultDto>;
}
