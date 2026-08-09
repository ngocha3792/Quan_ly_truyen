export interface MfaStatus {
  readonly enabled: boolean;
  readonly configuredAt: string | null;
  readonly recoveryCodesRemaining: number;
}

export interface BeginMfaEnrollmentRequest {
  readonly currentPassword: string;
}

export interface MfaEnrollment {
  readonly enrollmentId: string;
  readonly secret: string;
  readonly otpAuthUri: string;
  readonly expiresAt: string;
}

export interface ConfirmMfaEnrollmentRequest {
  readonly enrollmentId: string;
  readonly totpCode: string;
  readonly deviceName?: string;
}

export interface ConfirmMfaEnrollmentResponse {
  readonly status: MfaStatus;
  readonly recoveryCodes: readonly string[];
}

export interface VerifySensitiveActionRequest {
  readonly currentPassword: string;
  readonly totpCode: string;
}

export interface RegenerateRecoveryCodesResponse {
  readonly recoveryCodes: readonly string[];
  readonly generatedAt: string;
}

export interface RecoveryEmailStatus {
  readonly email: string | null;
  readonly verified: boolean;
  readonly verifiedAt: string | null;

  readonly pendingEmail: string | null;
  readonly pendingExpiresAt: string | null;
}

export interface RequestRecoveryEmailRequest {
  readonly email: string;
  readonly currentPassword: string;
}

export interface VerifyRecoveryEmailRequest {
  readonly code: string;
}

export interface RemoveRecoveryEmailRequest {
  readonly currentPassword: string;
}

export interface SecurityQuestionOption {
  readonly id: string;
  readonly label: string;
}

export interface ConfiguredSecurityQuestion {
  readonly id: string;
  readonly questionId: string;
  readonly label: string;
  readonly updatedAt: string;
}

export interface SecurityQuestionsState {
  readonly configured: boolean;
  readonly questions: readonly ConfiguredSecurityQuestion[];
  readonly updatedAt: string | null;
}

export interface SecurityQuestionAnswerInput {
  readonly questionId: string;
  readonly answer: string;
}

export interface UpdateSecurityQuestionsRequest {
  readonly currentPassword: string;
  readonly answers: readonly SecurityQuestionAnswerInput[];
}

export interface RemoveSecurityQuestionsRequest {
  readonly currentPassword: string;
}
