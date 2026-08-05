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
