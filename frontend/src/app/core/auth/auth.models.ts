export interface AuthUserSummary {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly displayName: string;
  readonly emailVerified: boolean;
  readonly roles: readonly string[];
}

export interface CurrentUser extends AuthUserSummary {
  readonly sessionId: string;
  readonly bio: string | null;
  readonly status: string;

  readonly emailVerifiedAt: string | null;
  readonly lastLoginAt: string | null;

  readonly avatar: {
    readonly id: string;
    readonly url: string | null;
  } | null;

  readonly authorProfile: {
    readonly id: string;
    readonly penName: string;
    readonly verificationStatus: string;
  } | null;

  readonly permissions: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoginRequest {
  readonly identifier: string;
  readonly password: string;
  readonly deviceId?: string;
  readonly deviceName?: string;
}

export interface LoginResponse {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly expiresAt: string;
  readonly user: AuthUserSummary;
}

export interface RegisterRequest {
  readonly email: string;
  readonly username: string;
  readonly password: string;
  readonly displayName: string;
}

export interface RegisterResponse {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly displayName: string;
  readonly verificationRequired: true;
}

export interface RefreshTokenResponse {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly expiresAt: string;
}

export interface VerifyEmailResponse {
  readonly emailVerified: true;
  readonly alreadyVerified: boolean;
  readonly verifiedAt: string;
}

export interface ForgotPasswordResponse {
  readonly accepted: true;
  readonly message: string;
}

export interface ResetPasswordResponse {
  readonly passwordReset: true;
  readonly sessionsRevoked: number;
  readonly resetAt: string;
}

export interface ConfirmEmailChangeResponse {
  readonly emailChanged: true;
  readonly alreadyChanged: boolean;
  readonly previousEmail: string;
  readonly email: string;
  readonly sessionsRevoked: number;
  readonly reauthenticationRequired: true;
  readonly changedAt: string;
}

export interface AdminMfaChallengeDetails {
  readonly mfaTicket: string;
  readonly mode: 'enroll' | 'verify';
  readonly expiresAt: string;
}

export interface AdminMfaEnrollmentResponse {
  readonly secret: string;
  readonly otpAuthUri: string;
  readonly expiresAt: string;
}

export interface AdminMfaAuthenticationResponse extends LoginResponse {
  readonly recoveryCodes?: readonly string[];
}

export interface ConfirmAdminMfaEnrollmentRequest {
  readonly mfaTicket: string;
  readonly totpCode: string;
  readonly deviceId?: string;
  readonly deviceName?: string;
}

export interface VerifyAdminMfaRequest {
  readonly mfaTicket: string;
  readonly totpCode?: string;
  readonly recoveryCode?: string;
  readonly deviceId?: string;
  readonly deviceName?: string;
}

export interface AdminMfaAuthenticationResult {
  readonly user: CurrentUser;
  readonly recoveryCodes: readonly string[];
}
