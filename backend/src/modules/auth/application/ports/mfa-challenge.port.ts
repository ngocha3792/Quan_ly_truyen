import type { LoginClientContext } from '../commands/login/login.command';

export const MFA_CHALLENGE_PORT = Symbol('AUTH_MFA_CHALLENGE_PORT');

export type MfaChallengeMode = 'enroll' | 'verify';

export type MfaChallengeSource = 'password' | 'google' | 'github';

export interface CreateMfaChallengeInput {
  userId: string;

  mode: MfaChallengeMode;

  source: MfaChallengeSource;

  client: LoginClientContext;
}

export interface MfaChallengeResult {
  ticket: string;

  mode: MfaChallengeMode;

  expiresAt: Date;
}

export interface MfaChallengePort {
  /*
   * AUTH_ADMIN_MFA_ENABLED giờ chỉ còn là
   * policy bắt buộc MFA đối với ADMIN.
   *
   * Nó KHÔNG còn là feature flag để bật/tắt
   * MFA cho toàn hệ thống.
   */
  isAdminMfaRequired(): boolean;

  create(input: CreateMfaChallengeInput): Promise<MfaChallengeResult>;
}
